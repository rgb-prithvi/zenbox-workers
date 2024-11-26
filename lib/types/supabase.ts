export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      email_accounts: {
        Row: {
          access_token: string
          created_at: string
          email: string
          expires_at: string
          id: string
          refresh_token: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          refresh_token: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sync_states: {
        Row: {
          account_id: string
          completed_at: string | null
          created_at: string
          emails_synced: number
          error: string | null
          id: string
          last_history_id: string | null
          started_at: string
          status: string
          sync_type: string
          threads_synced: number
        }
        Insert: {
          account_id: string
          completed_at?: string | null
          created_at?: string
          emails_synced?: number
          error?: string | null
          id?: string
          last_history_id?: string | null
          started_at?: string
          status: string
          sync_type: string
          threads_synced?: number
        }
        Update: {
          account_id?: string
          completed_at?: string | null
          created_at?: string
          emails_synced?: number
          error?: string | null
          id?: string
          last_history_id?: string | null
          started_at?: string
          status?: string
          sync_type?: string
          threads_synced?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_sync_states_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "active_thread_details"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "email_sync_states_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "categorized_threads"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "email_sync_states_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_threads: {
        Row: {
          account_id: string
          created_at: string
          history_id: string | null
          id: string
          last_message_at: string
          subject: string | null
          thread_summary: Json | null
        }
        Insert: {
          account_id: string
          created_at?: string
          history_id?: string | null
          id: string
          last_message_at: string
          subject?: string | null
          thread_summary?: Json | null
        }
        Update: {
          account_id?: string
          created_at?: string
          history_id?: string | null
          id?: string
          last_message_at?: string
          subject?: string | null
          thread_summary?: Json | null
        }
        Relationships: []
      }
      emails: {
        Row: {
          account_id: string
          bcc: string[] | null
          body_html: string | null
          body_text: string | null
          cc: string[] | null
          content_hash: string | null
          created_at: string
          from: string
          id: string
          is_read: boolean | null
          labels: Database["public"]["Enums"]["gmail_system_label"][] | null
          received_at: string
          snippet: string | null
          subject: string | null
          thread_id: string
          to: string[] | null
        }
        Insert: {
          account_id: string
          bcc?: string[] | null
          body_html?: string | null
          body_text?: string | null
          cc?: string[] | null
          content_hash?: string | null
          created_at?: string
          from: string
          id: string
          is_read?: boolean | null
          labels?: Database["public"]["Enums"]["gmail_system_label"][] | null
          received_at: string
          snippet?: string | null
          subject?: string | null
          thread_id: string
          to?: string[] | null
        }
        Update: {
          account_id?: string
          bcc?: string[] | null
          body_html?: string | null
          body_text?: string | null
          cc?: string[] | null
          content_hash?: string | null
          created_at?: string
          from?: string
          id?: string
          is_read?: boolean | null
          labels?: Database["public"]["Enums"]["gmail_system_label"][] | null
          received_at?: string
          snippet?: string | null
          subject?: string | null
          thread_id?: string
          to?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "active_thread_details"
            referencedColumns: ["thread_id"]
          },
          {
            foreignKeyName: "emails_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "categorized_threads"
            referencedColumns: ["thread_id"]
          },
          {
            foreignKeyName: "emails_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_job_metrics: {
        Row: {
          created_at: string
          duration_ms: number
          email_id: string
          error: string | null
          id: string
          job_id: string
          success: boolean
          thread_id: string
        }
        Insert: {
          created_at?: string
          duration_ms: number
          email_id: string
          error?: string | null
          id?: string
          job_id: string
          success: boolean
          thread_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number
          email_id?: string
          error?: string | null
          id?: string
          job_id?: string
          success?: boolean
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "llm_job_metrics_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_job_metrics_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "active_thread_details"
            referencedColumns: ["thread_id"]
          },
          {
            foreignKeyName: "llm_job_metrics_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "categorized_threads"
            referencedColumns: ["thread_id"]
          },
          {
            foreignKeyName: "llm_job_metrics_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_classifications: {
        Row: {
          action_todos: Json | null
          category: Database["public"]["Enums"]["thread_category"]
          confidence_score: number
          created_at: string
          email_breakdown: string | null
          id: string
          is_automated: boolean
          reasoning: string
          scheduling_todos: Json | null
          summary_points: string[] | null
          thread_id: string
        }
        Insert: {
          action_todos?: Json | null
          category: Database["public"]["Enums"]["thread_category"]
          confidence_score: number
          created_at?: string
          email_breakdown?: string | null
          id?: string
          is_automated: boolean
          reasoning: string
          scheduling_todos?: Json | null
          summary_points?: string[] | null
          thread_id: string
        }
        Update: {
          action_todos?: Json | null
          category?: Database["public"]["Enums"]["thread_category"]
          confidence_score?: number
          created_at?: string
          email_breakdown?: string | null
          id?: string
          is_automated?: boolean
          reasoning?: string
          scheduling_todos?: Json | null
          summary_points?: string[] | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_classifications_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "active_thread_details"
            referencedColumns: ["thread_id"]
          },
          {
            foreignKeyName: "thread_classifications_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "categorized_threads"
            referencedColumns: ["thread_id"]
          },
          {
            foreignKeyName: "thread_classifications_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id?: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          signed_up_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          signed_up_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          signed_up_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      active_thread_details: {
        Row: {
          account_email: string | null
          account_id: string | null
          action_todos: Json | null
          category: Database["public"]["Enums"]["thread_category"] | null
          confidence_score: number | null
          emails: Json | null
          scheduling_todos: Json | null
          summary_points: string[] | null
          thread_id: string | null
          thread_subject: string | null
        }
        Relationships: []
      }
      categorized_threads: {
        Row: {
          account_email: string | null
          account_id: string | null
          action_todos: Json | null
          category: Database["public"]["Enums"]["thread_category"] | null
          confidence_score: number | null
          emails: Json | null
          last_message_at: string | null
          scheduling_todos: Json | null
          summary_points: string[] | null
          thread_id: string | null
          thread_subject: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      handle_google_auth: {
        Args: {
          p_user_id: string
          p_email: string
          p_access_token: string
          p_refresh_token: string
          p_expires_at: string
        }
        Returns: Json
      }
      handle_new_email_account: {
        Args: {
          p_email: string
          p_name: string
          p_access_token: string
          p_refresh_token: string
          p_expires_at: string
        }
        Returns: Json
      }
    }
    Enums: {
      gmail_system_label:
        | "INBOX"
        | "SENT"
        | "DRAFT"
        | "SPAM"
        | "TRASH"
        | "STARRED"
        | "IMPORTANT"
        | "UNREAD"
        | "CATEGORY_PERSONAL"
        | "CATEGORY_SOCIAL"
        | "CATEGORY_PROMOTIONS"
        | "CATEGORY_UPDATES"
        | "CATEGORY_FORUMS"
      human_input_level:
        | "URGENT_HUMAN"
        | "REVIEW_NEEDED"
        | "NO_ACTION"
        | "TRIGGER_ACTION"
        | "FILTER_OUT"
      thread_category:
        | "ACTIVE_DISCUSSION"
        | "PASSIVE_DISCUSSION"
        | "NOTIFICATION"
        | "MEETING"
        | "NEWSLETTER"
        | "NOT_RELEVANT"
        | "MARKETING"
      thread_type:
        | "DISCUSSION_ACTIVE"
        | "DISCUSSION_PASSIVE"
        | "NOTIFICATIONS"
        | "MEETING_RELATED"
        | "NEWSLETTER"
        | "MARKETING"
        | "INBOUND"
        | "OTHER"
      user_activeness_level: "is_active" | "is_mildly_active" | "inactive"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
