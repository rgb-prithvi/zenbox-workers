// Worker types
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

// Analysis types (specific to classifier service)
export interface AutomationIndicators {
  sender_patterns: string[];
  subject_patterns: string[];
  body_patterns: string[];
  footer_patterns: string[];
  marketing_patterns: string[];
  notification_patterns: string[];
  meeting_patterns: string[];
  newsletter_patterns: string[];
}

export interface EmailInput {
  from: string;
  subject: string;
  body: string;
} 