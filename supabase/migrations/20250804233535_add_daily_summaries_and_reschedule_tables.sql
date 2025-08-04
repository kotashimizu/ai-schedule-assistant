-- Add daily_summaries table for 18:00 automatic completion summaries
CREATE TABLE daily_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  total_tasks INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  completion_rate DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  total_estimated_minutes INTEGER DEFAULT 0,
  total_actual_minutes INTEGER DEFAULT 0,
  time_accuracy DECIMAL(3,2) DEFAULT 0.00,
  category_breakdown JSONB DEFAULT '{}',
  priority_breakdown JSONB DEFAULT '{}',
  postponed_tasks INTEGER DEFAULT 0,
  ai_summary TEXT,
  task_details JSONB DEFAULT '[]',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, summary_date),
  CHECK (completion_rate >= 0 AND completion_rate <= 1),
  CHECK (time_accuracy >= 0 AND time_accuracy <= 1),
  CHECK (total_tasks >= 0),
  CHECK (completed_tasks >= 0),
  CHECK (completed_tasks <= total_tasks),
  CHECK (total_estimated_minutes >= 0),
  CHECK (total_actual_minutes >= 0),
  CHECK (postponed_tasks >= 0)
);

-- Add reschedule_suggestions table for next-day task rescheduling
CREATE TABLE reschedule_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_date DATE NOT NULL, -- The date that had incomplete tasks
  suggestions_for_date DATE NOT NULL, -- The date suggestions are for (usually next day)
  incomplete_tasks_count INTEGER NOT NULL DEFAULT 0,
  suggestions_count INTEGER NOT NULL DEFAULT 0,
  suggestions_data JSONB DEFAULT '[]', -- Array of suggestion objects
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, target_date),
  CHECK (incomplete_tasks_count >= 0),
  CHECK (suggestions_count >= 0),
  CHECK (suggestions_count <= incomplete_tasks_count)
);

-- Add indexes for performance
CREATE INDEX idx_daily_summaries_user_date ON daily_summaries(user_id, summary_date DESC);
CREATE INDEX idx_daily_summaries_date ON daily_summaries(summary_date DESC);
CREATE INDEX idx_daily_summaries_completion_rate ON daily_summaries(completion_rate DESC);

CREATE INDEX idx_reschedule_suggestions_user_date ON reschedule_suggestions(user_id, target_date DESC);
CREATE INDEX idx_reschedule_suggestions_target_date ON reschedule_suggestions(target_date DESC);
CREATE INDEX idx_reschedule_suggestions_for_date ON reschedule_suggestions(suggestions_for_date DESC);

-- Add Row Level Security (RLS)
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reschedule_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_summaries
CREATE POLICY "Users can view their own daily summaries" ON daily_summaries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily summaries" ON daily_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily summaries" ON daily_summaries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily summaries" ON daily_summaries
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for reschedule_suggestions
CREATE POLICY "Users can view their own reschedule suggestions" ON reschedule_suggestions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reschedule suggestions" ON reschedule_suggestions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reschedule suggestions" ON reschedule_suggestions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reschedule suggestions" ON reschedule_suggestions
  FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_daily_summaries_updated_at
  BEFORE UPDATE ON daily_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reschedule_suggestions_updated_at
  BEFORE UPDATE ON reschedule_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE daily_summaries IS 'Stores daily task completion summaries generated at 18:00';
COMMENT ON TABLE reschedule_suggestions IS 'Stores AI-generated suggestions for rescheduling incomplete tasks';

COMMENT ON COLUMN daily_summaries.summary_date IS 'The date this summary covers';
COMMENT ON COLUMN daily_summaries.completion_rate IS 'Percentage of tasks completed (0.0 to 1.0)';
COMMENT ON COLUMN daily_summaries.time_accuracy IS 'Accuracy of time estimates (0.0 to 1.0)';
COMMENT ON COLUMN daily_summaries.category_breakdown IS 'JSON object with task counts per category';
COMMENT ON COLUMN daily_summaries.priority_breakdown IS 'JSON object with task counts per priority';
COMMENT ON COLUMN daily_summaries.ai_summary IS 'AI-generated textual summary of the day';
COMMENT ON COLUMN daily_summaries.task_details IS 'Array of completed task details for analysis';

COMMENT ON COLUMN reschedule_suggestions.target_date IS 'Original date that had incomplete tasks';
COMMENT ON COLUMN reschedule_suggestions.suggestions_for_date IS 'Date the suggestions are proposed for';
COMMENT ON COLUMN reschedule_suggestions.suggestions_data IS 'Array of suggestion objects with task IDs, time slots, and reasons';