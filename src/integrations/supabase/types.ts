export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      allocation_applications: {
        Row: {
          call_id: string
          created_at: string
          desired_quantity: number | null
          id: string
          status: Database["public"]["Enums"]["application_status"]
          worker_id: string
          worker_ref: string | null
        }
        Insert: {
          call_id: string
          created_at?: string
          desired_quantity?: number | null
          id?: string
          status?: Database["public"]["Enums"]["application_status"]
          worker_id: string
          worker_ref?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string
          desired_quantity?: number | null
          id?: string
          status?: Database["public"]["Enums"]["application_status"]
          worker_id?: string
          worker_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocation_applications_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "allocation_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_assignments: {
        Row: {
          assigned_at: string
          assigned_quantity: number | null
          call_id: string
          data_ref: string | null
          distributed_done_at: string | null
          id: string
          status: Database["public"]["Enums"]["assignment_status"]
          worker_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_quantity?: number | null
          call_id: string
          data_ref?: string | null
          distributed_done_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          worker_id: string
        }
        Update: {
          assigned_at?: string
          assigned_quantity?: number | null
          call_id?: string
          data_ref?: string | null
          distributed_done_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocation_assignments_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "allocation_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_calls: {
        Row: {
          apply_deadline: string
          board_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          title: string
          work_date: string
        }
        Insert: {
          apply_deadline: string
          board_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          title: string
          work_date: string
        }
        Update: {
          apply_deadline?: string
          board_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          title?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocation_calls_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_visits: {
        Row: {
          board_id: string
          id: string
          last_visited_at: string
          user_id: string
        }
        Insert: {
          board_id: string
          id?: string
          last_visited_at?: string
          user_id: string
        }
        Update: {
          board_id?: string
          id?: string
          last_visited_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_visits_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number
          project_id: string
          status: Database["public"]["Enums"]["board_status"]
          type: Database["public"]["Enums"]["board_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number
          project_id: string
          status?: Database["public"]["Enums"]["board_status"]
          type: Database["public"]["Enums"]["board_type"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          project_id?: string
          status?: Database["public"]["Enums"]["board_status"]
          type?: Database["public"]["Enums"]["board_type"]
        }
        Relationships: [
          {
            foreignKeyName: "boards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_attachments: {
        Row: {
          created_at: string
          file_path: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "dm_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_read_cursors: {
        Row: {
          id: string
          last_read_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          id?: string
          last_read_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_read_cursors_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_threads: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          project_id: string
          worker_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          project_id: string
          worker_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          project_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_threads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notification_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: Database["public"]["Enums"]["email_event_type"]
          id: string
          related_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: Database["public"]["Enums"]["email_event_type"]
          id?: string
          related_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: Database["public"]["Enums"]["email_event_type"]
          id?: string
          related_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          user_id?: string | null
        }
        Relationships: []
      }
      guide_acknowledgements: {
        Row: {
          acknowledged_at: string
          guide_version_id: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          guide_version_id: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          guide_version_id?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_acknowledgements_guide_version_id_fkey"
            columns: ["guide_version_id"]
            isOneToOne: false
            referencedRelation: "guide_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_acknowledgements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_documents: {
        Row: {
          board_id: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_documents_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_downloads: {
        Row: {
          downloaded_at: string
          guide_version_id: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          downloaded_at?: string
          guide_version_id: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          downloaded_at?: string
          guide_version_id?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_downloads_guide_version_id_fkey"
            columns: ["guide_version_id"]
            isOneToOne: false
            referencedRelation: "guide_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_downloads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_versions: {
        Row: {
          created_at: string
          created_by: string
          diff_summary: string | null
          document_id: string
          file_path: string
          id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by: string
          diff_summary?: string | null
          document_id: string
          file_path: string
          id?: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string
          diff_summary?: string | null
          document_id?: string
          file_path?: string
          id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "guide_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "guide_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      notice_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string | null
          notice_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type?: string | null
          notice_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          notice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_attachments_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
        ]
      }
      notice_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          notice_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          notice_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          notice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_comments_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
        ]
      }
      notice_reads: {
        Row: {
          id: string
          notice_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notice_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notice_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_reads_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          board_id: string
          body: string
          created_at: string
          created_by: string
          id: string
          is_pinned: boolean
          status: Database["public"]["Enums"]["post_status"]
          title: string
        }
        Insert: {
          board_id: string
          body: string
          created_at?: string
          created_by: string
          id?: string
          is_pinned?: boolean
          status?: Database["public"]["Enums"]["post_status"]
          title: string
        }
        Update: {
          board_id?: string
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          is_pinned?: boolean
          status?: Database["public"]["Enums"]["post_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          deep_link: string | null
          id: string
          is_read: boolean
          project_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          deep_link?: string | null
          id?: string
          is_read?: boolean
          project_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          deep_link?: string | null
          id?: string
          is_read?: boolean
          project_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      post_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string | null
          post_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type?: string | null
          post_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_attachments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          board_id: string
          body: string
          capture_image_path: string | null
          created_at: string
          data_no: string | null
          id: string
          status: Database["public"]["Enums"]["post_status"]
          title: string
          worker_ref: string | null
        }
        Insert: {
          author_id: string
          board_id: string
          body: string
          capture_image_path?: string | null
          created_at?: string
          data_no?: string | null
          id?: string
          status?: Database["public"]["Enums"]["post_status"]
          title: string
          worker_ref?: string | null
        }
        Update: {
          author_id?: string
          board_id?: string
          body?: string
          capture_image_path?: string | null
          created_at?: string
          data_no?: string | null
          id?: string
          status?: Database["public"]["Enums"]["post_status"]
          title?: string
          worker_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      project_admins: {
        Row: {
          admin_id: string
          custom_role: string | null
          id: string
          project_id: string
        }
        Insert: {
          admin_id: string
          custom_role?: string | null
          id?: string
          project_id: string
        }
        Update: {
          admin_id?: string
          custom_role?: string | null
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_admins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          project_id: string
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          project_id: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_latest_guide: {
        Row: {
          guide_version_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          guide_version_id: string
          project_id: string
          updated_at?: string
        }
        Update: {
          guide_version_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_latest_guide_guide_version_id_fkey"
            columns: ["guide_version_id"]
            isOneToOne: false
            referencedRelation: "guide_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_latest_guide_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_memberships: {
        Row: {
          created_at: string
          id: string
          project_id: string
          status: Database["public"]["Enums"]["membership_status"]
          worker_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          status?: Database["public"]["Enums"]["membership_status"]
          worker_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_memberships_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { _invitation_id: string }
        Returns: undefined
      }
      can_read_profile: {
        Args: { _profile_id: string; _reader_id: string }
        Returns: boolean
      }
      change_user_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _project_id?: string
          _target_user_id: string
        }
        Returns: undefined
      }
      delete_project_permanently: {
        Args: { _project_id: string }
        Returns: undefined
      }
      get_invitation_project_names: {
        Args: { _project_ids: string[] }
        Returns: {
          id: string
          name: string
        }[]
      }
      get_my_pending_invitations: {
        Args: never
        Returns: {
          created_at: string
          email: string
          expires_at: string
          id: string
          project_id: string
          status: string
        }[]
      }
      has_project_access: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_admin: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      search_profiles_for_invite: {
        Args: { _limit?: number; _query: string }
        Returns: {
          display_name: string
          email: string
          id: string
        }[]
      }
      send_project_notifications: {
        Args: {
          _body?: string
          _deep_link?: string
          _project_id?: string
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_ids: string[]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "worker"
      application_status: "APPLIED" | "SELECTED" | "REJECTED" | "WITHDRAWN"
      assignment_status: "ASSIGNED" | "DISTRIBUTED_DONE"
      board_status: "ACTIVE" | "ARCHIVED"
      board_type: "NOTICE" | "GUIDE" | "QNA" | "ALLOCATION" | "BUG" | "CUSTOM"
      email_event_type: "INVITE" | "ALLOCATION_DISTRIBUTED"
      email_status: "QUEUED" | "SENT" | "FAILED"
      invitation_status: "PENDING" | "ACCEPTED" | "EXPIRED"
      membership_status: "ACTIVE" | "REMOVED"
      notification_type:
        | "ALLOCATION_DISTRIBUTED"
        | "DM_NEW_MESSAGE"
        | "NOTICE_PUBLISHED"
        | "GUIDE_UPDATED"
      post_status: "ACTIVE" | "ARCHIVED"
      project_status: "ACTIVE" | "ARCHIVED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "worker"],
      application_status: ["APPLIED", "SELECTED", "REJECTED", "WITHDRAWN"],
      assignment_status: ["ASSIGNED", "DISTRIBUTED_DONE"],
      board_status: ["ACTIVE", "ARCHIVED"],
      board_type: ["NOTICE", "GUIDE", "QNA", "ALLOCATION", "BUG", "CUSTOM"],
      email_event_type: ["INVITE", "ALLOCATION_DISTRIBUTED"],
      email_status: ["QUEUED", "SENT", "FAILED"],
      invitation_status: ["PENDING", "ACCEPTED", "EXPIRED"],
      membership_status: ["ACTIVE", "REMOVED"],
      notification_type: [
        "ALLOCATION_DISTRIBUTED",
        "DM_NEW_MESSAGE",
        "NOTICE_PUBLISHED",
        "GUIDE_UPDATED",
      ],
      post_status: ["ACTIVE", "ARCHIVED"],
      project_status: ["ACTIVE", "ARCHIVED"],
    },
  },
} as const
