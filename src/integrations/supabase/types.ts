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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      course_photos: {
        Row: {
          caption: string
          display_order: number
          id: string
          photo_url: string
          uploaded_at: string
        }
        Insert: {
          caption?: string
          display_order?: number
          id?: string
          photo_url: string
          uploaded_at?: string
        }
        Update: {
          caption?: string
          display_order?: number
          id?: string
          photo_url?: string
          uploaded_at?: string
        }
        Relationships: []
      }
      hole_results: {
        Row: {
          created_at: string
          hole_number: number
          id: number
          match_id: string
          result: string
        }
        Insert: {
          created_at?: string
          hole_number: number
          id?: never
          match_id: string
          result: string
        }
        Update: {
          created_at?: string
          hole_number?: number
          id?: never
          match_id?: string
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "hole_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          comment: string | null
          date_label: string
          division: string
          feeds_into_match_id: string | null
          feeds_into_slot: number | null
          id: string
          is_bye: boolean
          match_date: string
          p1_hcp: number | null
          p1_name: string | null
          p1_seed: number | null
          p2_hcp: number | null
          p2_name: string | null
          p2_seed: number | null
          quick_diff: number | null
          quick_thru: number | null
          quick_updated_at: string | null
          result_text: string | null
          round: string
          sort_order: number
          status: string
          tee_time: string
          updated_at: string
          winner: string | null
        }
        Insert: {
          comment?: string | null
          date_label: string
          division: string
          feeds_into_match_id?: string | null
          feeds_into_slot?: number | null
          id: string
          is_bye?: boolean
          match_date: string
          p1_hcp?: number | null
          p1_name?: string | null
          p1_seed?: number | null
          p2_hcp?: number | null
          p2_name?: string | null
          p2_seed?: number | null
          quick_diff?: number | null
          quick_thru?: number | null
          quick_updated_at?: string | null
          result_text?: string | null
          round: string
          sort_order: number
          status?: string
          tee_time: string
          updated_at?: string
          winner?: string | null
        }
        Update: {
          comment?: string | null
          date_label?: string
          division?: string
          feeds_into_match_id?: string | null
          feeds_into_slot?: number | null
          id?: string
          is_bye?: boolean
          match_date?: string
          p1_hcp?: number | null
          p1_name?: string | null
          p1_seed?: number | null
          p2_hcp?: number | null
          p2_name?: string | null
          p2_seed?: number | null
          quick_diff?: number | null
          quick_thru?: number | null
          quick_updated_at?: string | null
          result_text?: string | null
          round?: string
          sort_order?: number
          status?: string
          tee_time?: string
          updated_at?: string
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_feeds_into_match_id_fkey"
            columns: ["feeds_into_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      player_photos: {
        Row: {
          photo_url: string
          player_name: string
          updated_at: string
        }
        Insert: {
          photo_url: string
          player_name: string
          updated_at?: string
        }
        Update: {
          photo_url?: string
          player_name?: string
          updated_at?: string
        }
        Relationships: []
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
    Enums: {},
  },
} as const
