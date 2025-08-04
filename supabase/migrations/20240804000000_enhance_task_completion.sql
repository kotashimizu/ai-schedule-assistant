-- AI Schedule Assistant - Enhanced Task Completion Features
-- Database schema updates for task 4.2 requirements

-- 1. Add missing fields to tasks table that APIs are already using
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER DEFAULT 15;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_minutes INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS postpone_count INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS postpone_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

-- 2. Add new fields for enhanced completion tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time_tracking_data JSONB DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completion_metadata JSONB DEFAULT '{}';

-- 3. Update the existing estimated_time column name for consistency (if it exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'estimated_time') THEN
        -- If data exists in estimated_time, migrate it to estimated_minutes
        UPDATE tasks SET estimated_minutes = estimated_time WHERE estimated_time IS NOT NULL AND estimated_minutes IS NULL;
        -- Drop the old column
        ALTER TABLE tasks DROP COLUMN estimated_time;
    END IF;
END $$;

-- 4. Update related_event_id column name for consistency
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'related_event_id') THEN
        -- If data exists in related_event_id, migrate it to event_id
        UPDATE tasks SET event_id = related_event_id WHERE related_event_id IS NOT NULL AND event_id IS NULL;
        -- Drop the old column
        ALTER TABLE tasks DROP COLUMN related_event_id;
    END IF;
END $$;

-- 5. Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_date ON tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_started_at ON tasks(started_at);
CREATE INDEX IF NOT EXISTS idx_tasks_postpone_count ON tasks(postpone_count);

-- 6. Create function for automatic time tracking
CREATE OR REPLACE FUNCTION track_task_time_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Track when task starts (status changes to in_progress)
    IF OLD.status != 'in_progress' AND NEW.status = 'in_progress' THEN
        NEW.started_at = NOW();
        NEW.time_tracking_data = COALESCE(NEW.time_tracking_data, '{}'::jsonb) || 
            jsonb_build_object('sessions', COALESCE(NEW.time_tracking_data->'sessions', '[]'::jsonb) || 
            jsonb_build_array(jsonb_build_object('started_at', NOW())));
    END IF;
    
    -- Track when task completes (status changes to completed)
    IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
        NEW.completed_at = NOW();
        
        -- Calculate actual minutes if not manually set and we have start time
        IF NEW.actual_minutes IS NULL AND NEW.started_at IS NOT NULL THEN
            NEW.actual_minutes = EXTRACT(EPOCH FROM (NOW() - NEW.started_at)) / 60;
        END IF;
        
        -- Store completion metadata
        NEW.completion_metadata = COALESCE(NEW.completion_metadata, '{}'::jsonb) || jsonb_build_object(
            'completed_at', NOW(),
            'estimated_vs_actual', CASE 
                WHEN NEW.estimated_minutes IS NOT NULL AND NEW.actual_minutes IS NOT NULL 
                THEN json_build_object(
                    'estimated', NEW.estimated_minutes,
                    'actual', NEW.actual_minutes,
                    'difference_minutes', NEW.actual_minutes - NEW.estimated_minutes,
                    'efficiency_ratio', ROUND((NEW.estimated_minutes::numeric / NEW.actual_minutes::numeric), 2)
                )
                ELSE NULL
            END,
            'was_postponed', NEW.postpone_count > 0,
            'postpone_count', NEW.postpone_count
        );
    END IF;
    
    -- Reset completion data if task is uncompleted
    IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
        NEW.completed_at = NULL;
        -- Optionally clear completion metadata or keep for history
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger for automatic time tracking
DROP TRIGGER IF EXISTS task_time_tracking_trigger ON tasks;
CREATE TRIGGER task_time_tracking_trigger
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION track_task_time_changes();

-- 8. Create function for daily summary data collection
CREATE OR REPLACE FUNCTION get_daily_task_summary(target_date DATE, target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    summary JSONB;
BEGIN
    SELECT jsonb_build_object(
        'date', target_date,
        'user_id', target_user_id,
        'completed_tasks', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', id,
                'title', title,
                'estimated_minutes', estimated_minutes,
                'actual_minutes', actual_minutes,
                'efficiency_ratio', CASE 
                    WHEN estimated_minutes > 0 AND actual_minutes > 0 
                    THEN ROUND((estimated_minutes::numeric / actual_minutes::numeric), 2)
                    ELSE NULL
                END,
                'completed_at', completed_at,
                'was_postponed', postpone_count > 0,
                'postpone_count', postpone_count,
                'priority', priority,
                'category', category
            ))
            FROM tasks 
            WHERE user_id = target_user_id 
                AND status = 'completed' 
                AND DATE(completed_at) = target_date
        ),
        'incomplete_tasks', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', id,
                'title', title,
                'status', status,
                'estimated_minutes', estimated_minutes,
                'priority', priority,
                'due_date', due_date,
                'scheduled_date', scheduled_date,
                'postpone_count', postpone_count,
                'suggest_reschedule', postpone_count > 0 OR (due_date IS NOT NULL AND due_date < NOW())
            ))
            FROM tasks 
            WHERE user_id = target_user_id 
                AND status IN ('pending', 'in_progress')
                AND (scheduled_date IS NULL OR DATE(scheduled_date) <= target_date)
        ),
        'summary_stats', jsonb_build_object(
            'total_completed', (
                SELECT COUNT(*) FROM tasks 
                WHERE user_id = target_user_id 
                    AND status = 'completed' 
                    AND DATE(completed_at) = target_date
            ),
            'total_estimated_time', (
                SELECT COALESCE(SUM(estimated_minutes), 0) FROM tasks 
                WHERE user_id = target_user_id 
                    AND status = 'completed' 
                    AND DATE(completed_at) = target_date
            ),
            'total_actual_time', (
                SELECT COALESCE(SUM(actual_minutes), 0) FROM tasks 
                WHERE user_id = target_user_id 
                    AND status = 'completed' 
                    AND DATE(completed_at) = target_date
            ),
            'average_efficiency', (
                SELECT ROUND(AVG(
                    CASE WHEN estimated_minutes > 0 AND actual_minutes > 0 
                    THEN (estimated_minutes::numeric / actual_minutes::numeric)
                    ELSE NULL END
                ), 2)
                FROM tasks 
                WHERE user_id = target_user_id 
                    AND status = 'completed' 
                    AND DATE(completed_at) = target_date
            ),
            'tasks_postponed', (
                SELECT COUNT(*) FROM tasks 
                WHERE user_id = target_user_id 
                    AND postpone_count > 0
                    AND (scheduled_date IS NULL OR DATE(scheduled_date) <= target_date)
                    AND status IN ('pending', 'in_progress')
            )
        )
    ) INTO summary;
    
    RETURN summary;
END;
$$ LANGUAGE plpgsql;

-- 9. Create table for daily summaries (for 18:00 automatic generation)
CREATE TABLE IF NOT EXISTS daily_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    summary_data JSONB NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT unique_user_daily_summary UNIQUE (user_id, summary_date)
);

-- 10. Create indexes for daily summaries
CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_id ON daily_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(summary_date);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_generated_at ON daily_summaries(generated_at);

-- 11. Add comments for documentation
COMMENT ON COLUMN tasks.started_at IS 'Timestamp when task status changed to in_progress';
COMMENT ON COLUMN tasks.completed_at IS 'Timestamp when task status changed to completed';
COMMENT ON COLUMN tasks.time_tracking_data IS 'JSON data for detailed time tracking sessions';
COMMENT ON COLUMN tasks.completion_metadata IS 'JSON data with completion analysis and metrics';
COMMENT ON COLUMN tasks.postpone_count IS 'Number of times task has been postponed/rescheduled';
COMMENT ON COLUMN tasks.postpone_reason IS 'Optional reason for the last postponement';

COMMENT ON FUNCTION get_daily_task_summary(DATE, UUID) IS 'Generate comprehensive daily task summary for user';
COMMENT ON TABLE daily_summaries IS 'Stores daily task completion summaries for 18:00 automated reports';