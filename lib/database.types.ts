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
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_email: string
          created_at: string
          id: string
          new_value: Json | null
          prior_value: Json | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_email: string
          created_at?: string
          id?: string
          new_value?: Json | null
          prior_value?: Json | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_email?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          prior_value?: Json | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      admin_rate_limit_events: {
        Row: {
          action_key: string
          admin_email: string
          created_at: string
          id: string
        }
        Insert: {
          action_key: string
          admin_email: string
          created_at?: string
          id?: string
        }
        Update: {
          action_key?: string
          admin_email?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      admin_recent_views: {
        Row: {
          admin_email: string
          candidate_email: string
          candidate_name: string | null
          candidate_user_id: string
          viewed_at: string
        }
        Insert: {
          admin_email: string
          candidate_email: string
          candidate_name?: string | null
          candidate_user_id: string
          viewed_at?: string
        }
        Update: {
          admin_email?: string
          candidate_email?: string
          candidate_name?: string | null
          candidate_user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      candidate_deletions: {
        Row: {
          purge_after: string
          purged_at: string | null
          requested_at: string
          requested_by: string
          user_id: string
        }
        Insert: {
          purge_after: string
          purged_at?: string | null
          requested_at?: string
          requested_by: string
          user_id: string
        }
        Update: {
          purge_after?: string
          purged_at?: string | null
          requested_at?: string
          requested_by?: string
          user_id?: string
        }
        Relationships: []
      }
      candidate_profile_overrides: {
        Row: {
          location: string | null
          phone_number: string | null
          total_experience: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          location?: string | null
          phone_number?: string | null
          total_experience?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          location?: string | null
          phone_number?: string | null
          total_experience?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_detail_requests: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          id: string
          linkedin_url: string
          requested_at: string
          role_title: string | null
          status: string
          user_id: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          linkedin_url: string
          requested_at?: string
          role_title?: string | null
          status?: string
          user_id: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          linkedin_url?: string
          requested_at?: string
          role_title?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      counselling_requests: {
        Row: {
          completed_at: string | null
          id: string
          notes: string | null
          order_id: string
          requested_at: string
          scheduled_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          requested_at?: string
          scheduled_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          requested_at?: string
          scheduled_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "counselling_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "razorpay_transactions"
            referencedColumns: ["order_id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string
          key: string
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_html: string
          body_text: string
          key: string
          subject: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_html?: string
          body_text?: string
          key?: string
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      extension_lookups: {
        Row: {
          created_at: string
          id: string
          linkedin_url: string
          matched_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          linkedin_url: string
          matched_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          linkedin_url?: string
          matched_user_id?: string | null
        }
        Relationships: []
      }
      fitment_interviews: {
        Row: {
          has_resumed: boolean
          launch_fail_count: number
          ib_agent_id: string
          ib_candidate_id: string
          ib_interview_status: string | null
          ib_job_id: string
          id: string
          invited_at: string
          magic_link: string | null
          magic_link_expires_at: string | null
          report_generation_requested_at: string | null
          report_overridden: boolean
          report_raw: Json | null
          role_title: string
          status: string
          stuck_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          has_resumed?: boolean
          launch_fail_count?: number
          ib_agent_id: string
          ib_candidate_id: string
          ib_interview_status?: string | null
          ib_job_id: string
          id?: string
          invited_at?: string
          magic_link?: string | null
          magic_link_expires_at?: string | null
          report_generation_requested_at?: string | null
          report_overridden?: boolean
          report_raw?: Json | null
          role_title: string
          status?: string
          stuck_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          has_resumed?: boolean
          launch_fail_count?: number
          ib_agent_id?: string
          ib_candidate_id?: string
          ib_interview_status?: string | null
          ib_job_id?: string
          id?: string
          invited_at?: string
          magic_link?: string | null
          magic_link_expires_at?: string | null
          report_generation_requested_at?: string | null
          report_overridden?: boolean
          report_raw?: Json | null
          role_title?: string
          status?: string
          stuck_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fitment_leads: {
        Row: {
          candidate_level: Database["public"]["Enums"]["candidate_level"] | null
          created_at: string
          cv_text: string | null
          email: string
          ib_applied_job_id: string | null
          ib_job_id: string | null
          ib_resume_id: string | null
          id: string
          jd_source: string
          jd_text: string
          name: string | null
          phone: string | null
          resume_match_overridden: boolean
          resume_match_raw: Json | null
          resume_match_score: number | null
          resume_match_status: string | null
          resume_text: string | null
          role_title: string
          score: number
          user_id: string | null
          verdict: string
        }
        Insert: {
          candidate_level?:
            | Database["public"]["Enums"]["candidate_level"]
            | null
          created_at?: string
          cv_text?: string | null
          email: string
          ib_applied_job_id?: string | null
          ib_job_id?: string | null
          ib_resume_id?: string | null
          id?: string
          jd_source: string
          jd_text: string
          name?: string | null
          phone?: string | null
          resume_match_overridden?: boolean
          resume_match_raw?: Json | null
          resume_match_score?: number | null
          resume_match_status?: string | null
          resume_text?: string | null
          role_title: string
          score: number
          user_id?: string | null
          verdict: string
        }
        Update: {
          candidate_level?:
            | Database["public"]["Enums"]["candidate_level"]
            | null
          created_at?: string
          cv_text?: string | null
          email?: string
          ib_applied_job_id?: string | null
          ib_job_id?: string | null
          ib_resume_id?: string | null
          id?: string
          jd_source?: string
          jd_text?: string
          name?: string | null
          phone?: string | null
          resume_match_overridden?: boolean
          resume_match_raw?: Json | null
          resume_match_score?: number | null
          resume_match_status?: string | null
          resume_text?: string | null
          role_title?: string
          score?: number
          user_id?: string | null
          verdict?: string
        }
        Relationships: []
      }
      fitment_reports: {
        Row: {
          action_plan: Json
          categories: Json
          generated_at: string
          role_title: string
          user_id: string
          verdict_summary: string
        }
        Insert: {
          action_plan?: Json
          categories?: Json
          generated_at?: string
          role_title: string
          user_id: string
          verdict_summary?: string
        }
        Update: {
          action_plan?: Json
          categories?: Json
          generated_at?: string
          role_title?: string
          user_id?: string
          verdict_summary?: string
        }
        Relationships: []
      }
      hub_notifications: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          message: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      intervuebox_webhook_events: {
        Row: {
          created_at: string
          id: string
          raw_payload: Json
          sweep_error: string | null
          sweep_result: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          raw_payload: Json
          sweep_error?: string | null
          sweep_result?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          raw_payload?: Json
          sweep_error?: string | null
          sweep_result?: Json | null
        }
        Relationships: []
      }
      learned_skill_keywords: {
        Row: {
          first_seen_at: string
          sample_job_title: string | null
          skill: string
        }
        Insert: {
          first_seen_at?: string
          sample_job_title?: string | null
          skill: string
        }
        Update: {
          first_seen_at?: string
          sample_job_title?: string | null
          skill?: string
        }
        Relationships: []
      }
      personality_tests: {
        Row: {
          answers: Json
          completed_at: string
          role_title: string
          scores: Json
          user_id: string
          validity: Json
        }
        Insert: {
          answers: Json
          completed_at?: string
          role_title: string
          scores: Json
          user_id: string
          validity: Json
        }
        Update: {
          answers?: Json
          completed_at?: string
          role_title?: string
          scores?: Json
          user_id?: string
          validity?: Json
        }
        Relationships: []
      }
      pipeline_failures: {
        Row: {
          created_at: string
          detail: Json
          id: string
          kind: string
          lead_id: string | null
          order_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail: Json
          id?: string
          kind: string
          lead_id?: string | null
          order_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          lead_id?: string | null
          order_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_failures_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "fitment_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_failures_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "razorpay_transactions"
            referencedColumns: ["order_id"]
          },
        ]
      }
      product_unlocks: {
        Row: {
          product: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          product: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          product?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      razorpay_transactions: {
        Row: {
          amount_paise: number
          consumed_at: string | null
          created_at: string
          lead_id: string | null
          level: Database["public"]["Enums"]["candidate_level"]
          order_id: string
          payment_id: string | null
          product: Database["public"]["Enums"]["product_type"]
          status: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          consumed_at?: string | null
          created_at?: string
          lead_id?: string | null
          level: Database["public"]["Enums"]["candidate_level"]
          order_id: string
          payment_id?: string | null
          product: Database["public"]["Enums"]["product_type"]
          status?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          consumed_at?: string | null
          created_at?: string
          lead_id?: string | null
          level?: Database["public"]["Enums"]["candidate_level"]
          order_id?: string
          payment_id?: string | null
          product?: Database["public"]["Enums"]["product_type"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "razorpay_transactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "fitment_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_action_log: {
        Row: {
          action: string
          created_at: string
          detail: Json | null
          id: string
          recruiter_email: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          created_at?: string
          detail?: Json | null
          id?: string
          recruiter_email: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: Json | null
          id?: string
          recruiter_email?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      recruiter_identities: {
        Row: {
          banned_at: string | null
          company_name: string | null
          email: string
          verification_sent_at: string | null
          verification_token: string | null
          verified_at: string | null
        }
        Insert: {
          banned_at?: string | null
          company_name?: string | null
          email: string
          verification_sent_at?: string | null
          verification_token?: string | null
          verified_at?: string | null
        }
        Update: {
          banned_at?: string | null
          company_name?: string | null
          email?: string
          verification_sent_at?: string | null
          verification_token?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      recruiter_preview_audit: {
        Row: {
          action: string
          id: string
          lead_id: string
          timestamp: string
          user_id: string
        }
        Insert: {
          action: string
          id?: string
          lead_id: string
          timestamp?: string
          user_id: string
        }
        Update: {
          action?: string
          id?: string
          lead_id?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_preview_audit_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "fitment_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_preview_audit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_preview_sections: {
        Row: {
          lead_id: string
          sections: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          lead_id: string
          sections?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          lead_id?: string
          sections?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_preview_sections_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "fitment_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_preview_sections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_preview_settings: {
        Row: {
          enabled: boolean
          linkedin_url: string | null
          sections: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          enabled?: boolean
          linkedin_url?: string | null
          sections?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          linkedin_url?: string | null
          sections?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recruiter_sourced_prospects: {
        Row: {
          candidate_level: string
          candidate_name: string | null
          claim_token: string | null
          converted_lead_id: string | null
          created_at: string
          ib_applied_job_id: string | null
          ib_job_id: string | null
          ib_resume_id: string | null
          id: string
          jd_hash: string
          jd_text: string
          linkedin_url: string
          recruiter_email: string
          resume_match_raw: Json | null
          shortlisted: boolean
          shortlisted_at: string | null
          status: string
        }
        Insert: {
          candidate_level: string
          candidate_name?: string | null
          claim_token?: string | null
          converted_lead_id?: string | null
          created_at?: string
          ib_applied_job_id?: string | null
          ib_job_id?: string | null
          ib_resume_id?: string | null
          id?: string
          jd_hash: string
          jd_text: string
          linkedin_url: string
          recruiter_email: string
          resume_match_raw?: Json | null
          shortlisted?: boolean
          shortlisted_at?: string | null
          status?: string
        }
        Update: {
          candidate_level?: string
          candidate_name?: string | null
          claim_token?: string | null
          converted_lead_id?: string | null
          created_at?: string
          ib_applied_job_id?: string | null
          ib_job_id?: string | null
          ib_resume_id?: string | null
          id?: string
          jd_hash?: string
          jd_text?: string
          linkedin_url?: string
          recruiter_email?: string
          resume_match_raw?: Json | null
          shortlisted?: boolean
          shortlisted_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_sourced_prospects_converted_lead_id_fkey"
            columns: ["converted_lead_id"]
            isOneToOne: false
            referencedRelation: "fitment_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_sourced_prospects_recruiter_email_fkey"
            columns: ["recruiter_email"]
            isOneToOne: false
            referencedRelation: "recruiter_identities"
            referencedColumns: ["email"]
          },
        ]
      }
      referees: {
        Row: {
          created_at: string
          custom_role: string | null
          email: string
          experience_level:
            | Database["public"]["Enums"]["referee_experience_level"]
            | null
          feedback_opened_at: string | null
          id: string
          last_reminded_at: string | null
          linkedin_url: string | null
          name: string
          organization: string | null
          overall_feedback: string | null
          phone: string | null
          ratings: Json | null
          reference_check_id: string
          reminder_count: number
          role: string
          status: Database["public"]["Enums"]["referee_status"]
        }
        Insert: {
          created_at?: string
          custom_role?: string | null
          email: string
          experience_level?:
            | Database["public"]["Enums"]["referee_experience_level"]
            | null
          feedback_opened_at?: string | null
          id?: string
          last_reminded_at?: string | null
          linkedin_url?: string | null
          name: string
          organization?: string | null
          overall_feedback?: string | null
          phone?: string | null
          ratings?: Json | null
          reference_check_id: string
          reminder_count?: number
          role: string
          status?: Database["public"]["Enums"]["referee_status"]
        }
        Update: {
          created_at?: string
          custom_role?: string | null
          email?: string
          experience_level?:
            | Database["public"]["Enums"]["referee_experience_level"]
            | null
          feedback_opened_at?: string | null
          id?: string
          last_reminded_at?: string | null
          linkedin_url?: string | null
          name?: string
          organization?: string | null
          overall_feedback?: string | null
          phone?: string | null
          ratings?: Json | null
          reference_check_id?: string
          reminder_count?: number
          role?: string
          status?: Database["public"]["Enums"]["referee_status"]
        }
        Relationships: [
          {
            foreignKeyName: "referees_reference_check_id_fkey"
            columns: ["reference_check_id"]
            isOneToOne: false
            referencedRelation: "reference_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_checks: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          min_references: number
          status: Database["public"]["Enums"]["reference_check_status"]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          min_references?: number
          status?: Database["public"]["Enums"]["reference_check_status"]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          min_references?: number
          status?: Database["public"]["Enums"]["reference_check_status"]
          user_id?: string
        }
        Relationships: []
      }
      reference_tokens: {
        Row: {
          created_at: string
          expires_at: string
          reference_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          reference_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          reference_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_tokens_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "referees"
            referencedColumns: ["id"]
          },
        ]
      }
      report_share_links: {
        Row: {
          created_at: string
          expires_at: string | null
          include: string
          interview_sections: string
          last_viewed_at: string | null
          revoked_at: string | null
          role_title: string
          token: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          include: string
          interview_sections?: string
          last_viewed_at?: string | null
          revoked_at?: string | null
          role_title: string
          token: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          include?: string
          interview_sections?: string
          last_viewed_at?: string | null
          revoked_at?: string | null
          role_title?: string
          token?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      report_unlocks: {
        Row: {
          lead_id: string | null
          role_title: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          lead_id?: string | null
          role_title: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          lead_id?: string | null
          role_title?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_unlocks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "fitment_leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      merge_candidate_accounts: {
        Args: { keep_user_id: string; merge_user_id: string }
        Returns: Json
      }
      purge_candidate_data: { Args: { target_user_id: string }; Returns: Json }
    }
    Enums: {
      candidate_level: "entry" | "mid" | "senior"
      product_type:
        | "report"
        | "personality"
        | "references"
        | "interview"
        | "counselling"
        | "bundle"
      referee_experience_level: "fresher" | "experienced"
      referee_status: "pending" | "completed" | "rejected"
      reference_check_status:
        | "initiated"
        | "in_progress"
        | "completed"
        | "cancelled"
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
      candidate_level: ["entry", "mid", "senior"],
      product_type: [
        "report",
        "personality",
        "references",
        "interview",
        "counselling",
        "bundle",
      ],
      referee_experience_level: ["fresher", "experienced"],
      referee_status: ["pending", "completed", "rejected"],
      reference_check_status: [
        "initiated",
        "in_progress",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
