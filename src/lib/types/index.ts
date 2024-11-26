export interface WorkerJobData {
  email: string;
  sync_type: "FULL_SYNC" | "BACKFILL_SYNC" | "INCREMENTAL_SYNC";
  days_to_sync?: number;
  user_context?: string;
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
