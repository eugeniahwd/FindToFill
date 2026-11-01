// Database types for supabase/migrations. Hand-written in the same shape as
// `supabase gen types typescript`; regenerate with the CLI once the project is linked
// and keep this file in sync with every new migration.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type ProfileRole = 'commuter' | 'admin';
type FacilityTypeValue = 'water' | 'charging';
type ReportStatusValue = 'available' | 'empty' | 'broken' | 'under_maintenance';
type DayType = 'weekday' | 'weekend';
type ChatOutcome = 'answered' | 'fallback_no_data' | 'fallback_ai_unavailable' | 'rejected';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          role: ProfileRole;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          role?: ProfileRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          role?: ProfileRole;
          created_at?: string;
        };
        Relationships: [];
      };
      stations: {
        Row: {
          id: string;
          name: string;
          lines: string[];
          latitude: number;
          longitude: number;
          is_pilot: boolean;
          is_demo_data: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          lines?: string[];
          latitude: number;
          longitude: number;
          is_pilot?: boolean;
          is_demo_data?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          lines?: string[];
          latitude?: number;
          longitude?: number;
          is_pilot?: boolean;
          is_demo_data?: boolean;
        };
        Relationships: [];
      };
      station_layouts: {
        Row: {
          id: string;
          station_id: string;
          level: string;
          image_url: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          station_id: string;
          level?: string;
          image_url: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          station_id?: string;
          level?: string;
          image_url?: string;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'station_layouts_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      facilities: {
        Row: {
          id: string;
          station_id: string;
          type: FacilityTypeValue;
          name: string;
          platform: string | null;
          location_detail: string | null;
          level: string | null;
          latitude: number;
          longitude: number;
          layout_x: number | null;
          layout_y: number | null;
          is_active: boolean;
          is_demo_data: boolean;
        };
        Insert: {
          id?: string;
          station_id: string;
          type: FacilityTypeValue;
          name: string;
          platform?: string | null;
          location_detail?: string | null;
          level?: string | null;
          latitude: number;
          longitude: number;
          layout_x?: number | null;
          layout_y?: number | null;
          is_active?: boolean;
          is_demo_data?: boolean;
        };
        Update: {
          id?: string;
          station_id?: string;
          type?: FacilityTypeValue;
          name?: string;
          platform?: string | null;
          location_detail?: string | null;
          level?: string | null;
          latitude?: number;
          longitude?: number;
          layout_x?: number | null;
          layout_y?: number | null;
          is_active?: boolean;
          is_demo_data?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'facilities_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          facility_id: string;
          user_id: string;
          status: ReportStatusValue;
          photo_path: string;
          note: string | null;
          created_at: string;
          removed_at: string | null;
          removed_by: string | null;
        };
        Insert: {
          id?: string;
          facility_id: string;
          user_id: string;
          status: ReportStatusValue;
          photo_path: string;
          note?: string | null;
          created_at?: string;
          removed_at?: string | null;
          removed_by?: string | null;
        };
        Update: {
          removed_at?: string | null;
          removed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_facility_id_fkey';
            columns: ['facility_id'];
            isOneToOne: false;
            referencedRelation: 'facilities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          facility_id: string;
          user_id: string;
          rating: number;
          comment: string;
          embedding: string | null;
          created_at: string;
          updated_at: string;
          removed_at: string | null;
          removed_by: string | null;
        };
        Insert: {
          id?: string;
          facility_id: string;
          user_id: string;
          rating: number;
          comment: string;
          embedding?: string | null;
          created_at?: string;
          updated_at?: string;
          removed_at?: string | null;
          removed_by?: string | null;
        };
        Update: {
          rating?: number;
          comment?: string;
          embedding?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_facility_id_fkey';
            columns: ['facility_id'];
            isOneToOne: false;
            referencedRelation: 'facilities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      favorites: {
        Row: {
          user_id: string;
          station_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          station_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          station_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favorites_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      stamps: {
        Row: {
          user_id: string;
          facility_id: string;
          stamped_at: string;
        };
        Insert: {
          user_id: string;
          facility_id: string;
          stamped_at?: string;
        };
        Update: {
          user_id?: string;
          facility_id?: string;
          stamped_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stamps_facility_id_fkey';
            columns: ['facility_id'];
            isOneToOne: false;
            referencedRelation: 'facilities';
            referencedColumns: ['id'];
          },
        ];
      };
      schedules: {
        Row: {
          id: string;
          station_id: string;
          line: string;
          direction: string;
          day_type: DayType;
          departure_time: string;
        };
        Insert: {
          id?: string;
          station_id: string;
          line: string;
          direction: string;
          day_type: DayType;
          departure_time: string;
        };
        Update: {
          id?: string;
          station_id?: string;
          line?: string;
          direction?: string;
          day_type?: DayType;
          departure_time?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'schedules_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      rate_limit_events: {
        Row: {
          id: number;
          key: string;
          action: string;
          created_at: string;
        };
        Insert: {
          key: string;
          action: string;
          created_at?: string;
        };
        Update: {
          key?: string;
          action?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_logs: {
        Row: {
          id: string;
          session_id: string;
          quick_message_id: string;
          tools_called: Json;
          outcome: ChatOutcome;
          latency_ms: number | null;
          station_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          quick_message_id: string;
          tools_called?: Json;
          outcome: ChatOutcome;
          latency_ms?: number | null;
          station_id?: string | null;
          created_at?: string;
        };
        Update: {
          outcome?: ChatOutcome;
          latency_ms?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_logs_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      facility_status: {
        Row: {
          facility_id: string;
          status: ReportStatusValue | null;
          last_reported_at: string | null;
          photo_path: string | null;
          active_report_count: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      match_reviews: {
        Args: {
          query_embedding: string;
          p_station_id: string;
          match_count?: number;
        };
        Returns: {
          review_id: string;
          facility_id: string;
          rating: number;
          comment: string;
          created_at: string;
          similarity: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database['public'];

export type TableRow<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TableInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type TableUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
export type ViewRow<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row'];
