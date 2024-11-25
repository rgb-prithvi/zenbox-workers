export interface WorkerJobData {
  email: string;
  sync_type: "FULL_SYNC" | "BACKFILL_SYNC" | "INCREMENTAL_SYNC";
  days_to_sync?: number;
}

export interface SyncMetrics {
  startTime: number;
  threadsProcessed: number;
  emailsProcessed: number;
  errors: number;
  retries: number;
}
