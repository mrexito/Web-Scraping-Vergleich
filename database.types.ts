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
      CourseDetails: {
        Row: {
          Beratungsgespraech: boolean
          "Dauer der Kurse in Std. Kurzzeitkurs": number | null
          "Dauer der Kurse in Wochen Langzeitkurs": number | null
          "Eigene Lernunterlagen": boolean
          ID: number
          "info freien Plaetze?": boolean
          "Info zur Erfolgsquote": boolean
          "Kursart (Intensiv- oder Langzeitkurs)": string | null
          Nachholmoeglichkeiten: boolean
          Pruefungsarchiv: boolean
          Qualitaetsbewertung: number | null
          Spezielles: string | null
          Standort: string | null
          Unterrichttag: string | null
          "Unterstuezung ausserhalb Unterrichtszeit": boolean
        }
        Insert: {
          Beratungsgespraech: boolean
          "Dauer der Kurse in Std. Kurzzeitkurs"?: number | null
          "Dauer der Kurse in Wochen Langzeitkurs"?: number | null
          "Eigene Lernunterlagen": boolean
          ID?: number
          "info freien Plaetze?": boolean
          "Info zur Erfolgsquote": boolean
          "Kursart (Intensiv- oder Langzeitkurs)"?: string | null
          Nachholmoeglichkeiten: boolean
          Pruefungsarchiv: boolean
          Qualitaetsbewertung?: number | null
          Spezielles?: string | null
          Standort?: string | null
          Unterrichttag?: string | null
          "Unterstuezung ausserhalb Unterrichtszeit": boolean
        }
        Update: {
          Beratungsgespraech?: boolean
          "Dauer der Kurse in Std. Kurzzeitkurs"?: number | null
          "Dauer der Kurse in Wochen Langzeitkurs"?: number | null
          "Eigene Lernunterlagen"?: boolean
          ID?: number
          "info freien Plaetze?"?: boolean
          "Info zur Erfolgsquote"?: boolean
          "Kursart (Intensiv- oder Langzeitkurs)"?: string | null
          Nachholmoeglichkeiten?: boolean
          Pruefungsarchiv?: boolean
          Qualitaetsbewertung?: number | null
          Spezielles?: string | null
          Standort?: string | null
          Unterrichttag?: string | null
          "Unterstuezung ausserhalb Unterrichtszeit"?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "KursDetails_ID_fkey"
            columns: ["ID"]
            isOneToOne: true
            referencedRelation: "GymiProviders"
            referencedColumns: ["ID"]
          },
        ]
      }
      courses: {
        Row: {
          course_type: string | null
          course_url: string | null
          duration_weeks: number | null
          end_date: string | null
          has_digital_material: boolean | null
          id: string
          is_online: boolean | null
          last_scraped_at: string | null
          location: string | null
          occurrence: string | null
          price_chf: number | null
          provider_id: number | null
          scraped_data_raw: Json | null
          start_date: string | null
          title: string
        }
        Insert: {
          course_type?: string | null
          course_url?: string | null
          duration_weeks?: number | null
          end_date?: string | null
          has_digital_material?: boolean | null
          id?: string
          is_online?: boolean | null
          last_scraped_at?: string | null
          location?: string | null
          occurrence?: string | null
          price_chf?: number | null
          provider_id?: number | null
          scraped_data_raw?: Json | null
          start_date?: string | null
          title: string
        }
        Update: {
          course_type?: string | null
          course_url?: string | null
          duration_weeks?: number | null
          end_date?: string | null
          has_digital_material?: boolean | null
          id?: string
          is_online?: boolean | null
          last_scraped_at?: string | null
          location?: string | null
          occurrence?: string | null
          price_chf?: number | null
          provider_id?: number | null
          scraped_data_raw?: Json | null
          start_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "GymiProviders"
            referencedColumns: ["ID"]
          },
        ]
      }
      GymiProviders: {
        Row: {
          Aufsatzkorrektur: boolean
          "E-Learning": boolean
          Einstufungstest: boolean
          Einzelkurse: boolean
          ID: number
          "Maximale Anzahl der Teilnehmer": string | null
          Name: string
          Onlinepruefung: boolean
          "Preis Intensiver Kurs": number | null
          "Preis Langzeit Kurs": number | null
          Pruefungssimultaion: boolean | null
          URL: string[] | null
        }
        Insert: {
          Aufsatzkorrektur: boolean
          "E-Learning": boolean
          Einstufungstest: boolean
          Einzelkurse: boolean
          ID?: number
          "Maximale Anzahl der Teilnehmer"?: string | null
          Name?: string
          Onlinepruefung: boolean
          "Preis Intensiver Kurs"?: number | null
          "Preis Langzeit Kurs"?: number | null
          Pruefungssimultaion?: boolean | null
          URL?: string[] | null
        }
        Update: {
          Aufsatzkorrektur?: boolean
          "E-Learning"?: boolean
          Einstufungstest?: boolean
          Einzelkurse?: boolean
          ID?: number
          "Maximale Anzahl der Teilnehmer"?: string | null
          Name?: string
          Onlinepruefung?: boolean
          "Preis Intensiver Kurs"?: number | null
          "Preis Langzeit Kurs"?: number | null
          Pruefungssimultaion?: boolean | null
          URL?: string[] | null
        }
        Relationships: []
      }
      price_history: {
        Row: {
          course_type: string
          id: string
          price_chf: number
          provider_id: number
          recorded_at: string
        }
        Insert: {
          course_type: string
          id?: string
          price_chf: number
          provider_id: number
          recorded_at?: string
        }
        Update: {
          course_type?: string
          id?: string
          price_chf?: number
          provider_id?: number
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "GymiProviders"
            referencedColumns: ["ID"]
          },
        ]
      }
      providers: {
        Row: {
          created_at: string
          id: number
          logo_url: string | null
          name: string
          official_name: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id: number
          logo_url?: string | null
          name: string
          official_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          logo_url?: string | null
          name?: string
          official_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      scrape_errors: {
        Row: {
          ai_suggested_selector: string | null
          created_at: string
          error_type: string
          fixed_at: string | null
          fixed_by_ai: boolean | null
          html_snapshot: string | null
          id: string
          message: string
          provider_id: number | null
          run_id: string | null
        }
        Insert: {
          ai_suggested_selector?: string | null
          created_at?: string
          error_type: string
          fixed_at?: string | null
          fixed_by_ai?: boolean | null
          html_snapshot?: string | null
          id?: string
          message: string
          provider_id?: number | null
          run_id?: string | null
        }
        Update: {
          ai_suggested_selector?: string | null
          created_at?: string
          error_type?: string
          fixed_at?: string | null
          fixed_by_ai?: boolean | null
          html_snapshot?: string | null
          id?: string
          message?: string
          provider_id?: number | null
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scrape_errors_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "GymiProviders"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "scrape_errors_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "scrape_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_runs: {
        Row: {
          finished_at: string | null
          id: string
          scraper_type: string
          started_at: string
          status: string
        }
        Insert: {
          finished_at?: string | null
          id?: string
          scraper_type: string
          started_at?: string
          status?: string
        }
        Update: {
          finished_at?: string | null
          id?: string
          scraper_type?: string
          started_at?: string
          status?: string
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
