export enum EmailCategory {
  MARKETING = "Marketing",
  NOTIFICATION = "Notification",
  MEETING = "Meeting",
  NEWSLETTER = "Newsletter"
}

export interface EmailAccount {
  id: string;
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  created_at: Date;
  email_sync_states?: {
    last_history_id: string;
  }
}

export interface Email {
  id: string;
  thread_id: string;
  account_id: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  snippet: string;
  is_read: boolean;
  received_at: Date;
  created_at: Date;
}

export interface EmailThread {
  id: string;
  account_id: string;
  subject: string;
  history_id: string;
  last_message_at: Date;
  thread_summary: any;
  created_at: Date;
}

export interface ThreadTodo {
  text: string;
  due_date?: string;
  priority?: 'high' | 'medium' | 'low';
  completed?: boolean;
}

export interface ThreadClassification {
  id: string;
  thread_id: string;
  summary_points: string[];
  category: EmailCategory | null;
  confidence_score: number;
  reasoning: string;
  scheduling_todos: ThreadTodo[];
  action_todos: ThreadTodo[];
  is_automated: boolean;
  created_at: Date;
}

export interface WorkerJobData {
  email_account_id: string;
  sync_type: 'FIRST_SYNC' | 'INCREMENTAL_SYNC' | 'BACKFILL_SYNC';
  days_to_sync?: number;
}

export interface SyncMetrics {
  startTime: number;
  threadsProcessed: number;
  emailsProcessed: number;
  errors: number;
  retries: number;
} 