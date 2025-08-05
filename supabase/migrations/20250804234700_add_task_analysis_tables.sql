-- Add parent_task_id and breakdown_metadata to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS breakdown_metadata JSONB DEFAULT NULL;

-- Add task_analyses table for storing analysis results
CREATE TABLE task_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN ('postponed', 'productivity', 'comprehensive')),
  analysis_results JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add productivity_metrics_snapshots table for historical metrics
CREATE TABLE productivity_metrics_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period VARCHAR(20) NOT NULL CHECK (period IN ('last_7_days', 'last_30_days', 'last_90_days')),
  metrics_data JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX idx_tasks_breakdown_metadata ON tasks USING GIN(breakdown_metadata) WHERE breakdown_metadata IS NOT NULL;

CREATE INDEX idx_task_analyses_user_type ON task_analyses(user_id, analysis_type);
CREATE INDEX idx_task_analyses_generated_at ON task_analyses(generated_at DESC);

CREATE INDEX idx_productivity_metrics_user_period ON productivity_metrics_snapshots(user_id, period);
CREATE INDEX idx_productivity_metrics_generated_at ON productivity_metrics_snapshots(generated_at DESC);

-- Add Row Level Security (RLS)
ALTER TABLE task_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE productivity_metrics_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_analyses
CREATE POLICY "Users can view their own task analyses" ON task_analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task analyses" ON task_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task analyses" ON task_analyses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task analyses" ON task_analyses
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for productivity_metrics_snapshots
CREATE POLICY "Users can view their own productivity metrics" ON productivity_metrics_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own productivity metrics" ON productivity_metrics_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own productivity metrics" ON productivity_metrics_snapshots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own productivity metrics" ON productivity_metrics_snapshots
  FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for updated_at columns
CREATE TRIGGER update_task_analyses_updated_at
  BEFORE UPDATE ON task_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_productivity_metrics_snapshots_updated_at
  BEFORE UPDATE ON productivity_metrics_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE task_analyses IS 'Stores comprehensive task analysis results including postponed task detection and productivity analysis';
COMMENT ON TABLE productivity_metrics_snapshots IS 'Historical snapshots of productivity metrics for trend analysis';

COMMENT ON COLUMN tasks.parent_task_id IS 'Reference to parent task if this is a subtask created from task breakdown';
COMMENT ON COLUMN tasks.breakdown_metadata IS 'Metadata about task breakdown including reason, subtask count, and timing';

COMMENT ON COLUMN task_analyses.analysis_type IS 'Type of analysis: postponed (postponed task detection), productivity (metrics analysis), comprehensive (both)';
COMMENT ON COLUMN task_analyses.analysis_results IS 'Complete analysis results including suggestions, metrics, and recommendations';

COMMENT ON COLUMN productivity_metrics_snapshots.period IS 'Time period for metrics calculation';
COMMENT ON COLUMN productivity_metrics_snapshots.metrics_data IS 'Complete productivity metrics including completion rates, time accuracy, and trends';