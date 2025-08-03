export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          google_refresh_token: string | null;
          settings: Record<string, any> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          google_refresh_token?: string | null;
          settings?: Record<string, any> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          google_refresh_token?: string | null;
          settings?: Record<string, any> | null;
          updated_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          user_id: string;
          google_event_id: string | null;
          title: string;
          description: string | null;
          start_time: string;
          end_time: string;
          location: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          google_event_id?: string | null;
          title: string;
          description?: string | null;
          start_time: string;
          end_time: string;
          location?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          google_event_id?: string | null;
          title?: string;
          description?: string | null;
          start_time?: string;
          end_time?: string;
          location?: string | null;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          priority: 'high' | 'medium' | 'low';
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
          estimated_time: number | null;
          due_date: string | null;
          related_event_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          priority?: 'high' | 'medium' | 'low';
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
          estimated_time?: number | null;
          due_date?: string | null;
          related_event_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          priority?: 'high' | 'medium' | 'low';
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
          estimated_time?: number | null;
          due_date?: string | null;
          related_event_id?: string | null;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: 'reminder' | 'suggestion' | 'alert';
          title: string;
          message: string;
          sent_at: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'reminder' | 'suggestion' | 'alert';
          title: string;
          message: string;
          sent_at?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'reminder' | 'suggestion' | 'alert';
          title?: string;
          message?: string;
          sent_at?: string | null;
          read_at?: string | null;
        };
      };
      analytics_logs: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          data: Record<string, any> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          data?: Record<string, any> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          action?: string;
          data?: Record<string, any> | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      task_priority: 'high' | 'medium' | 'low';
      task_status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
      notification_type: 'reminder' | 'suggestion' | 'alert';
    };
  };
}