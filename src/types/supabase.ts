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
          body: string | null
          cc: string[] | null
          created_at: string
          from: string
          id: string
          is_read: boolean | null
          received_at: string
          snippet: string | null
          subject: string | null
          thread_id: string
          to: string[] | null
        }
        Insert: {
          account_id: string
          bcc?: string[] | null
          body?: string | null
          cc?: string[] | null
          created_at?: string
          from: string
          id: string
          is_read?: boolean | null
          received_at: string
          snippet?: string | null
          subject?: string | null
          thread_id: string
          to?: string[] | null
        }
        Update: {
          account_id?: string
          bcc?: string[] | null
          body?: string | null
          cc?: string[] | null
          created_at?: string
          from?: string
          id?: string
          is_read?: boolean | null
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
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_classifications: {
        Row: {
          action_todos: Json | null
          category: string
          confidence_score: number
          created_at: string
          id: string
          is_automated: boolean
          reasoning: string
          scheduling_todos: Json | null
          summary_points: string[] | null
          thread_id: string
        }
        Insert: {
          action_todos?: Json | null
          category: string
          confidence_score: number
          created_at?: string
          id?: string
          is_automated: boolean
          reasoning: string
          scheduling_todos?: Json | null
          summary_points?: string[] | null
          thread_id: string
        }
        Update: {
          action_todos?: Json | null
          category?: string
          confidence_score?: number
          created_at?: string
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
      [_ in never]: never
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
      human_input_level:
        | "URGENT_HUMAN"
        | "REVIEW_NEEDED"
        | "NO_ACTION"
        | "TRIGGER_ACTION"
        | "FILTER_OUT"
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
