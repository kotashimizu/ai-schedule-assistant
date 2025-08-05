-- Add notification system tables

-- Scheduled notifications table
CREATE TABLE scheduled_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('task_reminder', 'event_reminder', 'urgent_task', 'daily_summary', 'custom')),
  target_id UUID, -- Reference to task, event, or other entity
  title VARCHAR(200) NOT NULL,
  body VARCHAR(500) NOT NULL,
  notify_at TIMESTAMP WITH TIME ZONE NOT NULL,
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  status VARCHAR(20) NOT NULL CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled')) DEFAULT 'scheduled',
  sent_at TIMESTAMP WITH TIME ZONE,
  failed_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (notify_at > created_at),
  CHECK (retry_count >= 0 AND retry_count <= 5)
);

-- Notification interactions table for analytics
CREATE TABLE notification_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES scheduled_notifications(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('show', 'click', 'close', 'dismiss')),
  notification_title VARCHAR(200),
  notification_tag VARCHAR(100),
  interaction_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  device_info JSONB DEFAULT '{}',
  user_agent VARCHAR(500),
  additional_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily notification stats summary table
CREATE TABLE notification_daily_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  show_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  close_count INTEGER DEFAULT 0,
  dismiss_count INTEGER DEFAULT 0,
  click_through_rate DECIMAL(5,3) DEFAULT 0.000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, date),
  CHECK (show_count >= 0),
  CHECK (click_count >= 0),
  CHECK (close_count >= 0),
  CHECK (dismiss_count >= 0),
  CHECK (click_through_rate >= 0 AND click_through_rate <= 1)
);

-- Add indexes for performance
CREATE INDEX idx_scheduled_notifications_user_status ON scheduled_notifications(user_id, status);
CREATE INDEX idx_scheduled_notifications_notify_at ON scheduled_notifications(notify_at) WHERE status = 'scheduled';
CREATE INDEX idx_scheduled_notifications_type_target ON scheduled_notifications(type, target_id);
CREATE INDEX idx_scheduled_notifications_user_type ON scheduled_notifications(user_id, type);

CREATE INDEX idx_notification_interactions_user_timestamp ON notification_interactions(user_id, interaction_timestamp DESC);
CREATE INDEX idx_notification_interactions_action ON notification_interactions(action);
CREATE INDEX idx_notification_interactions_notification_id ON notification_interactions(notification_id) WHERE notification_id IS NOT NULL;

CREATE INDEX idx_notification_daily_stats_user_date ON notification_daily_stats(user_id, date DESC);
CREATE INDEX idx_notification_daily_stats_date ON notification_daily_stats(date DESC);

-- Add Row Level Security (RLS)
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_daily_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scheduled_notifications
CREATE POLICY "Users can view their own scheduled notifications" ON scheduled_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scheduled notifications" ON scheduled_notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled notifications" ON scheduled_notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled notifications" ON scheduled_notifications
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for notification_interactions
CREATE POLICY "Users can view their own notification interactions" ON notification_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification interactions" ON notification_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification interactions" ON notification_interactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification interactions" ON notification_interactions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for notification_daily_stats
CREATE POLICY "Users can view their own notification stats" ON notification_daily_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification stats" ON notification_daily_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification stats" ON notification_daily_stats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification stats" ON notification_daily_stats
  FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for updated_at columns
CREATE TRIGGER update_scheduled_notifications_updated_at
  BEFORE UPDATE ON scheduled_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_daily_stats_updated_at
  BEFORE UPDATE ON notification_daily_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically update click-through rate
CREATE OR REPLACE FUNCTION update_notification_stats_ctr()
RETURNS TRIGGER AS $$
BEGIN
  -- Update click-through rate when show_count or click_count changes
  IF NEW.show_count > 0 THEN
    NEW.click_through_rate = ROUND((NEW.click_count::DECIMAL / NEW.show_count::DECIMAL), 3);
  ELSE
    NEW.click_through_rate = 0.000;
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate CTR
CREATE TRIGGER update_notification_stats_ctr_trigger
  BEFORE UPDATE ON notification_daily_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_stats_ctr();

-- Function to cleanup old notifications (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  -- Delete old sent/failed notifications older than 90 days
  DELETE FROM scheduled_notifications 
  WHERE status IN ('sent', 'failed') 
    AND created_at < NOW() - INTERVAL '90 days';
  
  -- Delete old interaction logs older than 90 days
  DELETE FROM notification_interactions 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Keep daily stats for longer (1 year)
  DELETE FROM notification_daily_stats 
  WHERE date < CURRENT_DATE - INTERVAL '1 year';
  
  -- Log cleanup activity
  INSERT INTO analytics_logs (user_id, event_type, event_data)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::UUID,
    'notification_cleanup_executed',
    json_build_object(
      'cleanup_timestamp', NOW(),
      'cleanup_type', 'automated'
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE scheduled_notifications IS 'Stores scheduled notifications for tasks, events, and other reminders';
COMMENT ON TABLE notification_interactions IS 'Tracks user interactions with notifications for analytics';
COMMENT ON TABLE notification_daily_stats IS 'Daily aggregated statistics for notification performance';

COMMENT ON COLUMN scheduled_notifications.type IS 'Type of notification: task_reminder, event_reminder, urgent_task, daily_summary, custom';
COMMENT ON COLUMN scheduled_notifications.target_id IS 'ID of the related entity (task, event, etc.)';
COMMENT ON COLUMN scheduled_notifications.notify_at IS 'When the notification should be sent';
COMMENT ON COLUMN scheduled_notifications.status IS 'Current status: scheduled, sent, failed, cancelled';
COMMENT ON COLUMN scheduled_notifications.retry_count IS 'Number of retry attempts for failed notifications';

COMMENT ON COLUMN notification_interactions.action IS 'User action: show, click, close, dismiss';
COMMENT ON COLUMN notification_interactions.device_info IS 'Browser and device information for analytics';

COMMENT ON COLUMN notification_daily_stats.click_through_rate IS 'Percentage of notifications clicked vs shown (0.0 to 1.0)';

-- Create a view for notification analytics dashboard
CREATE VIEW notification_analytics_summary AS
SELECT 
  user_id,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE status = 'sent') as sent_notifications,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_notifications,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_notifications,
  COUNT(*) FILTER (WHERE type = 'task_reminder') as task_reminders,
  COUNT(*) FILTER (WHERE type = 'event_reminder') as event_reminders,
  COUNT(*) FILTER (WHERE type = 'urgent_task') as urgent_reminders,
  AVG(EXTRACT(EPOCH FROM (sent_at - notify_at))/60) FILTER (WHERE sent_at IS NOT NULL) as avg_delivery_delay_minutes,
  MIN(created_at) as first_notification,
  MAX(created_at) as latest_notification
FROM scheduled_notifications
GROUP BY user_id;

COMMENT ON VIEW notification_analytics_summary IS 'Summary view of notification statistics per user';