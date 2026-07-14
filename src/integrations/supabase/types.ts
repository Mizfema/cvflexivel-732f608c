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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_policies: {
        Row: {
          cooldown_hours: number | null
          enabled: boolean
          feature: string
          id: string
          max_per_day: number | null
          max_per_month: number | null
          max_per_session: number | null
          quota_group: string | null
          tier: string
        }
        Insert: {
          cooldown_hours?: number | null
          enabled?: boolean
          feature: string
          id?: string
          max_per_day?: number | null
          max_per_month?: number | null
          max_per_session?: number | null
          quota_group?: string | null
          tier: string
        }
        Update: {
          cooldown_hours?: number | null
          enabled?: boolean
          feature?: string
          id?: string
          max_per_day?: number | null
          max_per_month?: number | null
          max_per_session?: number | null
          quota_group?: string | null
          tier?: string
        }
        Relationships: []
      }
      admin_actions: {
        Row: {
          action_type: string
          actor_user_id: string | null
          created_at: string
          id: string
          metadata: Json
          reason: string
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason: string
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      ai_cost_alerts: {
        Row: {
          alert_date: string
          cost_usd_at_alert: number
          created_at: string
          id: string
          threshold_usd: number
        }
        Insert: {
          alert_date: string
          cost_usd_at_alert: number
          created_at?: string
          id?: string
          threshold_usd: number
        }
        Update: {
          alert_date?: string
          cost_usd_at_alert?: number
          created_at?: string
          id?: string
          threshold_usd?: number
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          anon_fingerprint: string | null
          cost_usd: number | null
          created_at: string
          feature: string
          id: string
          session_id: string | null
          tokens_in: number | null
          tokens_out: number | null
          user_id: string | null
        }
        Insert: {
          anon_fingerprint?: string | null
          cost_usd?: number | null
          created_at?: string
          feature: string
          id?: string
          session_id?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Update: {
          anon_fingerprint?: string | null
          cost_usd?: number | null
          created_at?: string
          feature?: string
          id?: string
          session_id?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      analyses: {
        Row: {
          coverage: Json
          created_at: string
          cv_id: string | null
          id: string
          job_tdr: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coverage?: Json
          created_at?: string
          cv_id?: string | null
          id?: string
          job_tdr: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coverage?: Json
          created_at?: string
          cv_id?: string | null
          id?: string
          job_tdr?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_cv_id_fkey"
            columns: ["cv_id"]
            isOneToOne: false
            referencedRelation: "cvs"
            referencedColumns: ["id"]
          },
        ]
      }
      cover_letters: {
        Row: {
          content: string
          created_at: string
          cv_id: string | null
          design: Json | null
          id: string
          job_tdr: string | null
          photo: Json | null
          template: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          cv_id?: string | null
          design?: Json | null
          id?: string
          job_tdr?: string | null
          photo?: Json | null
          template?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          cv_id?: string | null
          design?: Json | null
          id?: string
          job_tdr?: string | null
          photo?: Json | null
          template?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cover_letters_cv_id_fkey"
            columns: ["cv_id"]
            isOneToOne: false
            referencedRelation: "cvs"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_balances: {
        Row: {
          balance: number
          expires_at: string
          id: string
          package_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          expires_at: string
          id?: string
          package_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          expires_at?: string
          id?: string
          package_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          balance_after: number
          created_at: string
          delta: number
          feature: string | null
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          delta: number
          feature?: string | null
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          delta?: number
          feature?: string | null
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_weights: {
        Row: {
          feature: string
          weight: number
        }
        Insert: {
          feature: string
          weight: number
        }
        Update: {
          feature?: string
          weight?: number
        }
        Relationships: []
      }
      cvs: {
        Row: {
          created_at: string
          design: Json
          id: string
          sections: Json
          template: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          design?: Json
          id?: string
          sections?: Json
          template?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          design?: Json
          id?: string
          sections?: Json
          template?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interview_preps: {
        Row: {
          created_at: string
          cv_id: string | null
          id: string
          job_tdr: string | null
          questions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cv_id?: string | null
          id?: string
          job_tdr?: string | null
          questions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cv_id?: string | null
          id?: string
          job_tdr?: string | null
          questions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_preps_cv_id_fkey"
            columns: ["cv_id"]
            isOneToOne: false
            referencedRelation: "cvs"
            referencedColumns: ["id"]
          },
        ]
      }
      local_jobs: {
        Row: {
          category: string | null
          closing_date: string | null
          country: string
          created_at: string
          created_by: string | null
          description: string
          experience_level: string | null
          how_to_apply: string | null
          id: string
          is_active: boolean
          location: string | null
          organization: string
          requirements: string | null
          source_url: string | null
          theme: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          closing_date?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          description: string
          experience_level?: string | null
          how_to_apply?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          organization: string
          requirements?: string | null
          source_url?: string | null
          theme?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          closing_date?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          description?: string
          experience_level?: string | null
          how_to_apply?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          organization?: string
          requirements?: string | null
          source_url?: string | null
          theme?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          method: string | null
          paid_at: string | null
          period_days: number | null
          plan: string | null
          provider: string
          provider_ref: string | null
          reference: string | null
          status: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          method?: string | null
          paid_at?: string | null
          period_days?: number | null
          plan?: string | null
          provider: string
          provider_ref?: string | null
          reference?: string | null
          status: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          paid_at?: string | null
          period_days?: number | null
          plan?: string | null
          provider?: string
          provider_ref?: string | null
          reference?: string | null
          status?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_prices: {
        Row: {
          credits: number | null
          enabled: boolean
          label: string
          period_days: number | null
          plan: string
          price_mzn: number
        }
        Insert: {
          credits?: number | null
          enabled?: boolean
          label: string
          period_days?: number | null
          plan: string
          price_mzn: number
        }
        Update: {
          credits?: number | null
          enabled?: boolean
          label?: string
          period_days?: number | null
          plan?: string
          price_mzn?: number
        }
        Relationships: []
      }
      plan_reminder_emails: {
        Row: {
          id: string
          kind: string
          period_end: string
          sent_at: string
          subscription_id: string
        }
        Insert: {
          id?: string
          kind: string
          period_end: string
          sent_at?: string
          subscription_id: string
        }
        Update: {
          id?: string
          kind?: string
          period_end?: string
          sent_at?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_reminder_emails_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          full_name: string | null
          headline: string | null
          id: string
          linkedin: string | null
          phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          headline?: string | null
          id: string
          linkedin?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          headline?: string | null
          id?: string
          linkedin?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      reliefweb_cache: {
        Row: {
          cache_key: string
          fetched_at: string
          id: string
          payload: Json
        }
        Insert: {
          cache_key: string
          fetched_at?: string
          id?: string
          payload: Json
        }
        Update: {
          cache_key?: string
          fetched_at?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          payment_method: string | null
          plan: string
          provider: string
          provider_ref: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          payment_method?: string | null
          plan: string
          provider: string
          provider_ref?: string | null
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          payment_method?: string | null
          plan?: string
          provider?: string
          provider_ref?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_suspensions: {
        Row: {
          reason: string
          suspended_at: string
          suspended_by: string | null
          user_id: string
        }
        Insert: {
          reason: string
          suspended_at?: string
          suspended_by?: string | null
          user_id: string
        }
        Update: {
          reason?: string
          suspended_at?: string
          suspended_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      debit_credit_balance: {
        Args: { p_user_id: string; p_weight: number }
        Returns: number
      }
      grant_credit_balance: {
        Args: {
          p_amount: number
          p_new_expiry: string
          p_package_id: string
          p_require_existing: boolean
          p_user_id: string
        }
        Returns: {
          balance: number
          expires_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
