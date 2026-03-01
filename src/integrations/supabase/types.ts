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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          created_at: string | null
          id: string
          scholarship_id: string | null
          status: string | null
          student_id: string | null
          submission_data: Json | null
          submitted_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          scholarship_id?: string | null
          status?: string | null
          student_id?: string | null
          submission_data?: Json | null
          submitted_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          scholarship_id?: string | null
          status?: string | null
          student_id?: string | null
          submission_data?: Json | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      education_history: {
        Row: {
          course: string | null
          created_at: string
          degree_type: string
          grade: string | null
          graduated_year: number | null
          id: string
          institution: string
          user_id: string
        }
        Insert: {
          course?: string | null
          created_at?: string
          degree_type: string
          grade?: string | null
          graduated_year?: number | null
          id?: string
          institution: string
          user_id: string
        }
        Update: {
          course?: string | null
          created_at?: string
          degree_type?: string
          grade?: string | null
          graduated_year?: number | null
          id?: string
          institution?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          ai_reasoning: string | null
          created_at: string | null
          id: string
          match_score: number | null
          scholarship_id: string | null
          seen_by_student: boolean | null
          student_id: string | null
        }
        Insert: {
          ai_reasoning?: string | null
          created_at?: string | null
          id?: string
          match_score?: number | null
          scholarship_id?: string | null
          seen_by_student?: boolean | null
          student_id?: string | null
        }
        Update: {
          ai_reasoning?: string | null
          created_at?: string | null
          id?: string
          match_score?: number | null
          scholarship_id?: string | null
          seen_by_student?: boolean | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          country_origin: string | null
          created_at: string | null
          education_level: string | null
          email: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          target_countries: string[] | null
          target_courses: string[] | null
        }
        Insert: {
          bio?: string | null
          country_origin?: string | null
          created_at?: string | null
          education_level?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          target_countries?: string[] | null
          target_courses?: string[] | null
        }
        Update: {
          bio?: string | null
          country_origin?: string | null
          created_at?: string | null
          education_level?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          target_countries?: string[] | null
          target_courses?: string[] | null
        }
        Relationships: []
      }
      providers: {
        Row: {
          country: string | null
          created_at: string
          id: string
          name: string
          provider_type: string | null
          website: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          name: string
          provider_type?: string | null
          website?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          provider_type?: string | null
          website?: string | null
        }
        Relationships: []
      }
      saved_scholarships: {
        Row: {
          created_at: string
          id: string
          scholarship_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          scholarship_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          scholarship_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_scholarships_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarships: {
        Row: {
          amount: number | null
          confidence_score: number | null
          content_hash: string | null
          created_at: string | null
          currency: string | null
          deadline: string | null
          description: string | null
          eligibility_criteria: Json | null
          id: string
          is_active: boolean | null
          last_verified_at: string | null
          provider_id: string | null
          provider_name: string | null
          provider_type: string | null
          source_url: string | null
          tags: string[] | null
          title: string
        }
        Insert: {
          amount?: number | null
          confidence_score?: number | null
          content_hash?: string | null
          created_at?: string | null
          currency?: string | null
          deadline?: string | null
          description?: string | null
          eligibility_criteria?: Json | null
          id?: string
          is_active?: boolean | null
          last_verified_at?: string | null
          provider_id?: string | null
          provider_name?: string | null
          provider_type?: string | null
          source_url?: string | null
          tags?: string[] | null
          title: string
        }
        Update: {
          amount?: number | null
          confidence_score?: number | null
          content_hash?: string | null
          created_at?: string | null
          currency?: string | null
          deadline?: string | null
          description?: string | null
          eligibility_criteria?: Json | null
          id?: string
          is_active?: boolean | null
          last_verified_at?: string | null
          provider_id?: string | null
          provider_name?: string | null
          provider_type?: string | null
          source_url?: string | null
          tags?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      source_hubs: {
        Row: {
          country: string | null
          created_at: string
          error: string | null
          hub_url: string
          id: string
          is_active: boolean
          last_crawled_at: string | null
          provider_name: string | null
          provider_type: string | null
          status: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          error?: string | null
          hub_url: string
          id?: string
          is_active?: boolean
          last_crawled_at?: string | null
          provider_name?: string | null
          provider_type?: string | null
          status?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          error?: string | null
          hub_url?: string
          id?: string
          is_active?: boolean
          last_crawled_at?: string | null
          provider_name?: string | null
          provider_type?: string | null
          status?: string | null
        }
        Relationships: []
      }
      url_queue: {
        Row: {
          attempts: number
          created_at: string
          discovered_from: string | null
          id: string
          last_error: string | null
          processed_at: string | null
          provider_name: string | null
          provider_type: string | null
          status: string
          url: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          discovered_from?: string | null
          id?: string
          last_error?: string | null
          processed_at?: string | null
          provider_name?: string | null
          provider_type?: string | null
          status?: string
          url: string
        }
        Update: {
          attempts?: number
          created_at?: string
          discovered_from?: string | null
          id?: string
          last_error?: string | null
          processed_at?: string | null
          provider_name?: string | null
          provider_type?: string | null
          status?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "url_queue_discovered_from_fkey"
            columns: ["discovered_from"]
            isOneToOne: false
            referencedRelation: "source_hubs"
            referencedColumns: ["id"]
          },
        ]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "provider"
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
      app_role: ["student", "provider"],
    },
  },
} as const
