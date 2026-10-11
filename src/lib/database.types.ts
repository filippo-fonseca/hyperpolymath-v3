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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      actions: {
        Row: {
          actor_kind: string
          after: Json | null
          before: Json | null
          bot_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          reverted_at: string | null
          reverted_by: string | null
          summary: string
          tool: string
          user_id: string
        }
        Insert: {
          actor_kind: string
          after?: Json | null
          before?: Json | null
          bot_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          reverted_at?: string | null
          reverted_by?: string | null
          summary: string
          tool: string
          user_id: string
        }
        Update: {
          actor_kind?: string
          after?: Json | null
          before?: Json | null
          bot_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          reverted_at?: string | null
          reverted_by?: string | null
          summary?: string
          tool?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_reverted_by_fkey"
            columns: ["reverted_by"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          avatar_color: string
          avatar_shape: string
          created_at: string
          description: string | null
          id: string
          is_coordinator: boolean
          last_seen_at: string | null
          name: string
          parent_id: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_color?: string
          avatar_shape?: string
          created_at?: string
          description?: string | null
          id?: string
          is_coordinator?: boolean
          last_seen_at?: string | null
          name: string
          parent_id?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_color?: string
          avatar_shape?: string
          created_at?: string
          description?: string | null
          id?: string
          is_coordinator?: boolean
          last_seen_at?: string | null
          name?: string
          parent_id?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bots_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      captures: {
        Row: {
          archived_at: string | null
          content: string
          converted_task_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          resurface_at: string | null
          source: string
          updated_at: string
          urls: string[]
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          content: string
          converted_task_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          resurface_at?: string | null
          source?: string
          updated_at?: string
          urls?: string[]
          user_id: string
        }
        Update: {
          archived_at?: string | null
          content?: string
          converted_task_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          resurface_at?: string | null
          source?: string
          updated_at?: string
          urls?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "captures_converted_task_id_fkey"
            columns: ["converted_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          date: string
          habit_id: string
          id: string
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          date: string
          habit_id: string
          id?: string
          progress: number
          updated_at?: string
          user_id: string
        }
        Update: {
          date?: string
          habit_id?: string
          id?: string
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          archived_at: string | null
          created_at: string
          days_of_week: number[]
          icon: string | null
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          days_of_week?: number[]
          icon?: string | null
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          days_of_week?: number[]
          icon?: string | null
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mcp_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          name: string
          prefix: string
          revoked_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name: string
          prefix: string
          revoked_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          fire_count: number
          id: string
          last_error: string | null
          last_fired_at: string | null
          message: string | null
          next_fire_at: string | null
          remaining_count: number | null
          schedule: Json
          task_id: string | null
          until_date: string | null
          until_kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string
          fire_count?: number
          id?: string
          last_error?: string | null
          last_fired_at?: string | null
          message?: string | null
          next_fire_at?: string | null
          remaining_count?: number | null
          schedule: Json
          task_id?: string | null
          until_date?: string | null
          until_kind?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          fire_count?: number
          id?: string
          last_error?: string | null
          last_fired_at?: string | null
          message?: string | null
          next_fire_at?: string | null
          remaining_count?: number | null
          schedule?: Json
          task_id?: string | null
          until_date?: string | null
          until_kind?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          due_date: string | null
          due_time: string | null
          id: string
          list: string | null
          notes: string | null
          position: number
          priority: number
          recurrence: Json | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          list?: string | null
          notes?: string | null
          position?: number
          priority?: number
          recurrence?: Json | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          list?: string | null
          notes?: string | null
          position?: number
          priority?: number
          recurrence?: Json | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      widget_snapshots: {
        Row: {
          bot_id: string | null
          created_at: string
          id: string
          payload: Json
          user_id: string
          widget_id: string
        }
        Insert: {
          bot_id?: string | null
          created_at?: string
          id?: string
          payload: Json
          user_id: string
          widget_id: string
        }
        Update: {
          bot_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          user_id?: string
          widget_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_snapshots_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_snapshots_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widgets"
            referencedColumns: ["id"]
          },
        ]
      }
      widgets: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          kind: string
          owner_bot_id: string | null
          page: number
          payload: Json
          position: number
          published_at: string | null
          size: string
          stale_after_hours: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind: string
          owner_bot_id?: string | null
          page?: number
          payload?: Json
          position?: number
          published_at?: string | null
          size?: string
          stale_after_hours?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          owner_bot_id?: string | null
          page?: number
          payload?: Json
          position?: number
          published_at?: string | null
          size?: string
          stale_after_hours?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widgets_owner_bot_id_fkey"
            columns: ["owner_bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
