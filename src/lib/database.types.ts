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
      _bak_cash_log: {
        Row: {
          address: string | null
          amount_paid: number | null
          comments: string | null
          cost_gross: number | null
          cost_net: number | null
          created_at: string | null
          customer_name: string | null
          gross_weight: number | null
          id: string | null
          logged_at: string | null
          net_weight: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          skip_size: string | null
          ticket_number: string | null
          tyl_ref: string | null
          waste_type: string | null
        }
        Insert: {
          address?: string | null
          amount_paid?: number | null
          comments?: string | null
          cost_gross?: number | null
          cost_net?: number | null
          created_at?: string | null
          customer_name?: string | null
          gross_weight?: number | null
          id?: string | null
          logged_at?: string | null
          net_weight?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          skip_size?: string | null
          ticket_number?: string | null
          tyl_ref?: string | null
          waste_type?: string | null
        }
        Update: {
          address?: string | null
          amount_paid?: number | null
          comments?: string | null
          cost_gross?: number | null
          cost_net?: number | null
          created_at?: string | null
          customer_name?: string | null
          gross_weight?: number | null
          id?: string | null
          logged_at?: string | null
          net_weight?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          skip_size?: string | null
          ticket_number?: string | null
          tyl_ref?: string | null
          waste_type?: string | null
        }
        Relationships: []
      }
      _bak_customers: {
        Row: {
          account_balance: number | null
          address: string | null
          billing_address: string | null
          comments: string | null
          created_at: string | null
          credit_limit: number | null
          email: string | null
          full_name: string | null
          id: string | null
          invoice_type: string | null
          name: string | null
          payment_terms: string | null
          phone: string | null
          portal_pin: string | null
          shipping_address: string | null
          updated_at: string | null
        }
        Insert: {
          account_balance?: number | null
          address?: string | null
          billing_address?: string | null
          comments?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          invoice_type?: string | null
          name?: string | null
          payment_terms?: string | null
          phone?: string | null
          portal_pin?: string | null
          shipping_address?: string | null
          updated_at?: string | null
        }
        Update: {
          account_balance?: number | null
          address?: string | null
          billing_address?: string | null
          comments?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          invoice_type?: string | null
          name?: string | null
          payment_terms?: string | null
          phone?: string | null
          portal_pin?: string | null
          shipping_address?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      _bak_drivers: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          phone: string | null
          pin_code: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          phone?: string | null
          pin_code?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          phone?: string | null
          pin_code?: string | null
          status?: string | null
        }
        Relationships: []
      }
      _bak_hr_logs: {
        Row: {
          category: string | null
          employee: string | null
          id: string | null
          notes: string | null
          timestamp: string | null
        }
        Insert: {
          category?: string | null
          employee?: string | null
          id?: string | null
          notes?: string | null
          timestamp?: string | null
        }
        Update: {
          category?: string | null
          employee?: string | null
          id?: string | null
          notes?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      _bak_inventory: {
        Row: {
          comments: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_request: string | null
          date_booked: string | null
          delivery_address: string | null
          delivery_date: string | null
          id: string | null
          latitude: number | null
          longitude: number | null
          lorry_type: string | null
          payment_method: string | null
          payment_status: string | null
          priority_score: number | null
          scheduled_return_date: string | null
          skip_id: string | null
          skip_size: string | null
          status: string | null
          ticket_number: string | null
          updated_at: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_request?: string | null
          date_booked?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          id?: string | null
          latitude?: number | null
          longitude?: number | null
          lorry_type?: string | null
          payment_method?: string | null
          payment_status?: string | null
          priority_score?: number | null
          scheduled_return_date?: string | null
          skip_id?: string | null
          skip_size?: string | null
          status?: string | null
          ticket_number?: string | null
          updated_at?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_request?: string | null
          date_booked?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          id?: string | null
          latitude?: number | null
          longitude?: number | null
          lorry_type?: string | null
          payment_method?: string | null
          payment_status?: string | null
          priority_score?: number | null
          scheduled_return_date?: string | null
          skip_id?: string | null
          skip_size?: string | null
          status?: string | null
          ticket_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      _bak_orders: {
        Row: {
          address: string | null
          arrive_time: string | null
          assigned_driver_id: string | null
          comments: string | null
          completed_at: string | null
          cost_gross: number | null
          cost_net: number | null
          cost_vat: number | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          date: string | null
          delivery_comments: string | null
          depart_time: string | null
          driver_id: string | null
          driver_name: string | null
          earliest_time: string | null
          estimated_duration_mins: number | null
          id: string | null
          in_diary: boolean | null
          job_type: string | null
          latest_time: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          on_map: boolean | null
          order_date: string | null
          paid: boolean | null
          payment_method: string | null
          phone: string | null
          photo_proof: string | null
          priority_level: number | null
          proof_photo_url: string | null
          skip_id: string | null
          skip_id_used: string | null
          skip_size: string | null
          status: string | null
          time_slot: string | null
          voice_note_url: string | null
          wait_load_duration_mins: number | null
        }
        Insert: {
          address?: string | null
          arrive_time?: string | null
          assigned_driver_id?: string | null
          comments?: string | null
          completed_at?: string | null
          cost_gross?: number | null
          cost_net?: number | null
          cost_vat?: number | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          date?: string | null
          delivery_comments?: string | null
          depart_time?: string | null
          driver_id?: string | null
          driver_name?: string | null
          earliest_time?: string | null
          estimated_duration_mins?: number | null
          id?: string | null
          in_diary?: boolean | null
          job_type?: string | null
          latest_time?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          on_map?: boolean | null
          order_date?: string | null
          paid?: boolean | null
          payment_method?: string | null
          phone?: string | null
          photo_proof?: string | null
          priority_level?: number | null
          proof_photo_url?: string | null
          skip_id?: string | null
          skip_id_used?: string | null
          skip_size?: string | null
          status?: string | null
          time_slot?: string | null
          voice_note_url?: string | null
          wait_load_duration_mins?: number | null
        }
        Update: {
          address?: string | null
          arrive_time?: string | null
          assigned_driver_id?: string | null
          comments?: string | null
          completed_at?: string | null
          cost_gross?: number | null
          cost_net?: number | null
          cost_vat?: number | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          date?: string | null
          delivery_comments?: string | null
          depart_time?: string | null
          driver_id?: string | null
          driver_name?: string | null
          earliest_time?: string | null
          estimated_duration_mins?: number | null
          id?: string | null
          in_diary?: boolean | null
          job_type?: string | null
          latest_time?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          on_map?: boolean | null
          order_date?: string | null
          paid?: boolean | null
          payment_method?: string | null
          phone?: string | null
          photo_proof?: string | null
          priority_level?: number | null
          proof_photo_url?: string | null
          skip_id?: string | null
          skip_id_used?: string | null
          skip_size?: string | null
          status?: string | null
          time_slot?: string | null
          voice_note_url?: string | null
          wait_load_duration_mins?: number | null
        }
        Relationships: []
      }
      _bak_skip_combos: {
        Row: {
          combination: string | null
          id: string | null
        }
        Insert: {
          combination?: string | null
          id?: string | null
        }
        Update: {
          combination?: string | null
          id?: string | null
        }
        Relationships: []
      }
      _bak_tare_weights: {
        Row: {
          id: string | null
          lorry_registration: string | null
          skip_size: string | null
          tare_weight: number | null
        }
        Insert: {
          id?: string | null
          lorry_registration?: string | null
          skip_size?: string | null
          tare_weight?: number | null
        }
        Update: {
          id?: string | null
          lorry_registration?: string | null
          skip_size?: string | null
          tare_weight?: number | null
        }
        Relationships: []
      }
      _bak_weight_logs: {
        Row: {
          address: string | null
          customer_name: string | null
          direction: string | null
          gross_weight: number | null
          id: string | null
          logged_at: string | null
          lorry_reg: string | null
          net_weight: number | null
          notes: string | null
          skip_id: string | null
          skip_size: string | null
          tare_weight: number | null
          ticket_number: string | null
          waste_type: string | null
        }
        Insert: {
          address?: string | null
          customer_name?: string | null
          direction?: string | null
          gross_weight?: number | null
          id?: string | null
          logged_at?: string | null
          lorry_reg?: string | null
          net_weight?: number | null
          notes?: string | null
          skip_id?: string | null
          skip_size?: string | null
          tare_weight?: number | null
          ticket_number?: string | null
          waste_type?: string | null
        }
        Update: {
          address?: string | null
          customer_name?: string | null
          direction?: string | null
          gross_weight?: number | null
          id?: string | null
          logged_at?: string | null
          lorry_reg?: string | null
          net_weight?: number | null
          notes?: string | null
          skip_id?: string | null
          skip_size?: string | null
          tare_weight?: number | null
          ticket_number?: string | null
          waste_type?: string | null
        }
        Relationships: []
      }
      active_tippers: {
        Row: {
          address: string | null
          created_at: string | null
          customer_name: string | null
          gross_weight: number | null
          id: string
          net_weight: number | null
          notes: string | null
          reg: string | null
          skip_id: string | null
          skip_size: string | null
          tare_weight: number | null
          timestamp: string | null
          vehicle_reg: string | null
          waste_type: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          customer_name?: string | null
          gross_weight?: number | null
          id?: string
          net_weight?: number | null
          notes?: string | null
          reg?: string | null
          skip_id?: string | null
          skip_size?: string | null
          tare_weight?: number | null
          timestamp?: string | null
          vehicle_reg?: string | null
          waste_type?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          customer_name?: string | null
          gross_weight?: number | null
          id?: string
          net_weight?: number | null
          notes?: string | null
          reg?: string | null
          skip_id?: string | null
          skip_size?: string | null
          tare_weight?: number | null
          timestamp?: string | null
          vehicle_reg?: string | null
          waste_type?: string | null
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          actor_email: string | null
          actor_name: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string | null
          metadata: Json | null
          status: string | null
          type: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_name?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          status?: string | null
          type?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_name?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          status?: string | null
          type?: string | null
        }
        Relationships: []
      }
      archive_orders: {
        Row: {
          archived_at: string | null
          data: Json | null
          id: string
          original_id: string | null
        }
        Insert: {
          archived_at?: string | null
          data?: Json | null
          id?: string
          original_id?: string | null
        }
        Update: {
          archived_at?: string | null
          data?: Json | null
          id?: string
          original_id?: string | null
        }
        Relationships: []
      }
      carrier_licences: {
        Row: {
          created_at: string | null
          expiry_date: string | null
          holder_name: string
          id: string
          issue_date: string | null
          licence_number: string
          licence_type: string
          notes: string | null
          regulator: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expiry_date?: string | null
          holder_name: string
          id?: string
          issue_date?: string | null
          licence_number: string
          licence_type?: string
          notes?: string | null
          regulator?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expiry_date?: string | null
          holder_name?: string
          id?: string
          issue_date?: string | null
          licence_number?: string
          licence_type?: string
          notes?: string | null
          regulator?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cash_log: {
        Row: {
          address: string | null
          amount_paid: number | null
          comments: string | null
          cost_gross: number | null
          cost_net: number | null
          created_at: string | null
          customer_name: string
          ewc_code: string | null
          ewc_code_id: string | null
          gross_weight: number | null
          id: string
          logged_at: string | null
          net_weight: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          skip_size: string | null
          ticket_number: string | null
          tyl_ref: string | null
          waste_type: string | null
        }
        Insert: {
          address?: string | null
          amount_paid?: number | null
          comments?: string | null
          cost_gross?: number | null
          cost_net?: number | null
          created_at?: string | null
          customer_name: string
          ewc_code?: string | null
          ewc_code_id?: string | null
          gross_weight?: number | null
          id?: string
          logged_at?: string | null
          net_weight?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          skip_size?: string | null
          ticket_number?: string | null
          tyl_ref?: string | null
          waste_type?: string | null
        }
        Update: {
          address?: string | null
          amount_paid?: number | null
          comments?: string | null
          cost_gross?: number | null
          cost_net?: number | null
          created_at?: string | null
          customer_name?: string
          ewc_code?: string | null
          ewc_code_id?: string | null
          gross_weight?: number | null
          id?: string
          logged_at?: string | null
          net_weight?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          skip_size?: string | null
          ticket_number?: string | null
          tyl_ref?: string | null
          waste_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_log_ewc_code_id_fkey"
            columns: ["ewc_code_id"]
            isOneToOne: false
            referencedRelation: "ewc_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      config: {
        Row: {
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      custom_pricing: {
        Row: {
          created_at: string | null
          customer_name: string
          id: string
          net_price: number
          skip_size: string | null
          waste_type: string | null
        }
        Insert: {
          created_at?: string | null
          customer_name: string
          id?: string
          net_price: number
          skip_size?: string | null
          waste_type?: string | null
        }
        Update: {
          created_at?: string | null
          customer_name?: string
          id?: string
          net_price?: number
          skip_size?: string | null
          waste_type?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          account_balance: number | null
          address: string | null
          billing_address: string | null
          comments: string | null
          created_at: string | null
          credit_limit: number | null
          email: string | null
          full_name: string | null
          id: string
          invoice_type: string | null
          name: string
          payment_terms: string | null
          phone: string
          portal_pin: string | null
          shipping_address: string | null
          updated_at: string | null
        }
        Insert: {
          account_balance?: number | null
          address?: string | null
          billing_address?: string | null
          comments?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          full_name?: string | null
          id?: string
          invoice_type?: string | null
          name: string
          payment_terms?: string | null
          phone: string
          portal_pin?: string | null
          shipping_address?: string | null
          updated_at?: string | null
        }
        Update: {
          account_balance?: number | null
          address?: string | null
          billing_address?: string | null
          comments?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          full_name?: string | null
          id?: string
          invoice_type?: string | null
          name?: string
          payment_terms?: string | null
          phone?: string
          portal_pin?: string | null
          shipping_address?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      driver_hours: {
        Row: {
          break_minutes: number | null
          clock_in: string | null
          clock_out: string | null
          created_at: string | null
          date: string | null
          driver_id: string | null
          driver_name: string | null
          hours_worked: number | null
          id: string
          vehicle_id: string | null
          vehicle_reg: string | null
        }
        Insert: {
          break_minutes?: number | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          date?: string | null
          driver_id?: string | null
          driver_name?: string | null
          hours_worked?: number | null
          id?: string
          vehicle_id?: string | null
          vehicle_reg?: string | null
        }
        Update: {
          break_minutes?: number | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          date?: string | null
          driver_id?: string | null
          driver_name?: string | null
          hours_worked?: number | null
          id?: string
          vehicle_id?: string | null
          vehicle_reg?: string | null
        }
        Relationships: []
      }
      drivers: {
        Row: {
          created_at: string | null
          id: string
          name: string
          phone: string | null
          pin_code: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          phone?: string | null
          pin_code: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          pin_code?: string
          status?: string | null
        }
        Relationships: []
      }
      ewc_codes: {
        Row: {
          code: string
          description: string
          hazardous: boolean
          id: string
        }
        Insert: {
          code: string
          description: string
          hazardous?: boolean
          id?: string
        }
        Update: {
          code?: string
          description?: string
          hazardous?: boolean
          id?: string
        }
        Relationships: []
      }
      external_map_points: {
        Row: {
          created_at: string | null
          description: string | null
          folder: string | null
          id: string
          latitude: number
          longitude: number
          metadata: Json | null
          name: string
          style_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          folder?: string | null
          id?: string
          latitude: number
          longitude: number
          metadata?: Json | null
          name: string
          style_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          folder?: string | null
          id?: string
          latitude?: number
          longitude?: number
          metadata?: Json | null
          name?: string
          style_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fleet_logs: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          issue_type: string
          lorry_reg: string
          photo_url: string | null
          reported_by: string | null
          status: string | null
          timestamp: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          issue_type: string
          lorry_reg: string
          photo_url?: string | null
          reported_by?: string | null
          status?: string | null
          timestamp?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          issue_type?: string
          lorry_reg?: string
          photo_url?: string | null
          reported_by?: string | null
          status?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      fuel_cards: {
        Row: {
          id: string
          pin: string | null
          reg: string | null
        }
        Insert: {
          id?: string
          pin?: string | null
          reg?: string | null
        }
        Update: {
          id?: string
          pin?: string | null
          reg?: string | null
        }
        Relationships: []
      }
      hr_logs: {
        Row: {
          category: string
          employee: string
          id: string
          notes: string | null
          timestamp: string | null
        }
        Insert: {
          category: string
          employee: string
          id?: string
          notes?: string | null
          timestamp?: string | null
        }
        Update: {
          category?: string
          employee?: string
          id?: string
          notes?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      incidents: {
        Row: {
          description: string | null
          driver_name: string | null
          id: string
          location: string | null
          photo_url: string | null
          reported_at: string | null
          type: string | null
          vehicle_reg: string | null
        }
        Insert: {
          description?: string | null
          driver_name?: string | null
          id?: string
          location?: string | null
          photo_url?: string | null
          reported_at?: string | null
          type?: string | null
          vehicle_reg?: string | null
        }
        Update: {
          description?: string | null
          driver_name?: string | null
          id?: string
          location?: string | null
          photo_url?: string | null
          reported_at?: string | null
          type?: string | null
          vehicle_reg?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          comments: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_request: string | null
          date_booked: string | null
          delivery_address: string | null
          delivery_date: string | null
          id: string
          latitude: number | null
          longitude: number | null
          lorry_type: string | null
          payment_method: string | null
          payment_status: string | null
          priority_score: number | null
          scheduled_return_date: string | null
          skip_id: string
          skip_size: string
          status: string | null
          ticket_number: string | null
          updated_at: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_request?: string | null
          date_booked?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          lorry_type?: string | null
          payment_method?: string | null
          payment_status?: string | null
          priority_score?: number | null
          scheduled_return_date?: string | null
          skip_id: string
          skip_size: string
          status?: string | null
          ticket_number?: string | null
          updated_at?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_request?: string | null
          date_booked?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          lorry_type?: string | null
          payment_method?: string | null
          payment_status?: string | null
          priority_score?: number | null
          scheduled_return_date?: string | null
          skip_id?: string
          skip_size?: string
          status?: string | null
          ticket_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lorries: {
        Row: {
          brake_check: string | null
          created_at: string | null
          id: string
          loler_test: string | null
          lorry_type: string | null
          maintenance_due: string | null
          mot_due: string | null
          registration: string
          status: string | null
          tacho_calibration: string | null
          tax_due: string | null
          updated_at: string | null
          vehicle_condition: string | null
        }
        Insert: {
          brake_check?: string | null
          created_at?: string | null
          id?: string
          loler_test?: string | null
          lorry_type?: string | null
          maintenance_due?: string | null
          mot_due?: string | null
          registration: string
          status?: string | null
          tacho_calibration?: string | null
          tax_due?: string | null
          updated_at?: string | null
          vehicle_condition?: string | null
        }
        Update: {
          brake_check?: string | null
          created_at?: string | null
          id?: string
          loler_test?: string | null
          lorry_type?: string | null
          maintenance_due?: string | null
          mot_due?: string | null
          registration?: string
          status?: string | null
          tacho_calibration?: string | null
          tax_due?: string | null
          updated_at?: string | null
          vehicle_condition?: string | null
        }
        Relationships: []
      }
      maintenance_logs: {
        Row: {
          id: string
          issue_description: string | null
          lorry_reg: string
          repair_cost: number | null
          reported_by: string | null
          status: string | null
          timestamp: string | null
        }
        Insert: {
          id?: string
          issue_description?: string | null
          lorry_reg: string
          repair_cost?: number | null
          reported_by?: string | null
          status?: string | null
          timestamp?: string | null
        }
        Update: {
          id?: string
          issue_description?: string | null
          lorry_reg?: string
          repair_cost?: number | null
          reported_by?: string | null
          status?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      office_staff: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          email: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string
          arrive_time: string | null
          assigned_driver_id: string | null
          comments: string | null
          completed_at: string | null
          cost_gross: number | null
          cost_net: number | null
          cost_vat: number | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          date: string | null
          delivery_comments: string | null
          depart_time: string | null
          driver_id: string | null
          driver_name: string | null
          earliest_time: string | null
          estimated_duration_mins: number | null
          id: string
          in_diary: boolean | null
          job_type: string
          latest_time: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          on_map: boolean | null
          order_date: string | null
          paid: boolean | null
          payment_method: string | null
          phone: string | null
          photo_proof: string | null
          priority_level: number | null
          proof_photo_url: string | null
          skip_id: string | null
          skip_id_used: string | null
          skip_size: string
          status: string | null
          time_slot: string | null
          voice_note_url: string | null
          wait_load_duration_mins: number | null
        }
        Insert: {
          address: string
          arrive_time?: string | null
          assigned_driver_id?: string | null
          comments?: string | null
          completed_at?: string | null
          cost_gross?: number | null
          cost_net?: number | null
          cost_vat?: number | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          date?: string | null
          delivery_comments?: string | null
          depart_time?: string | null
          driver_id?: string | null
          driver_name?: string | null
          earliest_time?: string | null
          estimated_duration_mins?: number | null
          id?: string
          in_diary?: boolean | null
          job_type: string
          latest_time?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          on_map?: boolean | null
          order_date?: string | null
          paid?: boolean | null
          payment_method?: string | null
          phone?: string | null
          photo_proof?: string | null
          priority_level?: number | null
          proof_photo_url?: string | null
          skip_id?: string | null
          skip_id_used?: string | null
          skip_size: string
          status?: string | null
          time_slot?: string | null
          voice_note_url?: string | null
          wait_load_duration_mins?: number | null
        }
        Update: {
          address?: string
          arrive_time?: string | null
          assigned_driver_id?: string | null
          comments?: string | null
          completed_at?: string | null
          cost_gross?: number | null
          cost_net?: number | null
          cost_vat?: number | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          date?: string | null
          delivery_comments?: string | null
          depart_time?: string | null
          driver_id?: string | null
          driver_name?: string | null
          earliest_time?: string | null
          estimated_duration_mins?: number | null
          id?: string
          in_diary?: boolean | null
          job_type?: string
          latest_time?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          on_map?: boolean | null
          order_date?: string | null
          paid?: boolean | null
          payment_method?: string | null
          phone?: string | null
          photo_proof?: string | null
          priority_level?: number | null
          proof_photo_url?: string | null
          skip_id?: string | null
          skip_id_used?: string | null
          skip_size?: string
          status?: string | null
          time_slot?: string | null
          voice_note_url?: string | null
          wait_load_duration_mins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_skip_id_fkey"
            columns: ["skip_id"]
            isOneToOne: false
            referencedRelation: "skips"
            referencedColumns: ["id"]
          },
        ]
      }
      permits: {
        Row: {
          created_at: string | null
          date_applied: string | null
          date_issued: string | null
          expiry_date: string
          id: string
          location: string
          permit_number: string | null
          skip_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          date_applied?: string | null
          date_issued?: string | null
          expiry_date: string
          id?: string
          location: string
          permit_number?: string | null
          skip_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          date_applied?: string | null
          date_issued?: string | null
          expiry_date?: string
          id?: string
          location?: string
          permit_number?: string | null
          skip_id?: string
          status?: string | null
        }
        Relationships: []
      }
      route_performance_logs: {
        Row: {
          actual_arrival: string | null
          actual_duration_mins: number | null
          driver_id: string | null
          id: string
          logged_at: string | null
          order_id: string | null
          planned_arrival: string | null
          planned_duration_mins: number | null
          route_plan_id: string | null
        }
        Insert: {
          actual_arrival?: string | null
          actual_duration_mins?: number | null
          driver_id?: string | null
          id?: string
          logged_at?: string | null
          order_id?: string | null
          planned_arrival?: string | null
          planned_duration_mins?: number | null
          route_plan_id?: string | null
        }
        Update: {
          actual_arrival?: string | null
          actual_duration_mins?: number | null
          driver_id?: string | null
          id?: string
          logged_at?: string | null
          order_id?: string | null
          planned_arrival?: string | null
          planned_duration_mins?: number | null
          route_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_performance_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_performance_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_performance_logs_route_plan_id_fkey"
            columns: ["route_plan_id"]
            isOneToOne: false
            referencedRelation: "route_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      route_plans: {
        Row: {
          created_at: string | null
          driver_id: string | null
          estimated_fuel_cost: number | null
          id: string
          optimization_score: number | null
          plan_date: string
          route_sequence: Json
          status: string | null
          total_distance_km: number | null
          total_duration_mins: number | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id?: string | null
          estimated_fuel_cost?: number | null
          id?: string
          optimization_score?: number | null
          plan_date: string
          route_sequence: Json
          status?: string | null
          total_distance_km?: number | null
          total_duration_mins?: number | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string | null
          estimated_fuel_cost?: number | null
          id?: string
          optimization_score?: number | null
          plan_date?: string
          route_sequence?: Json
          status?: string | null
          total_distance_km?: number | null
          total_duration_mins?: number | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_plans_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_plans_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          break_mins: number | null
          clock_in: string
          clock_in_photo_url: string | null
          clock_out: string | null
          created_at: string | null
          date: string | null
          driver_id: string | null
          duration_mins: number | null
          employee: string | null
          id: string
          notes: string | null
          payable_hours: number | null
          role_or_lorry: string | null
          shift_date: string
          total_mins: number | null
        }
        Insert: {
          break_mins?: number | null
          clock_in: string
          clock_in_photo_url?: string | null
          clock_out?: string | null
          created_at?: string | null
          date?: string | null
          driver_id?: string | null
          duration_mins?: number | null
          employee?: string | null
          id?: string
          notes?: string | null
          payable_hours?: number | null
          role_or_lorry?: string | null
          shift_date: string
          total_mins?: number | null
        }
        Update: {
          break_mins?: number | null
          clock_in?: string
          clock_in_photo_url?: string | null
          clock_out?: string | null
          created_at?: string | null
          date?: string | null
          driver_id?: string | null
          duration_mins?: number | null
          employee?: string | null
          id?: string
          notes?: string | null
          payable_hours?: number | null
          role_or_lorry?: string | null
          shift_date?: string
          total_mins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      skip_combos: {
        Row: {
          combination: string
          id: string
        }
        Insert: {
          combination: string
          id?: string
        }
        Update: {
          combination?: string
          id?: string
        }
        Relationships: []
      }
      skips: {
        Row: {
          created_at: string | null
          customer_id: string | null
          delivered_at: string | null
          id: string
          location_address: string | null
          size: string
          skip_id: string
          status: string | null
          yard_location: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          id?: string
          location_address?: string | null
          size: string
          skip_id: string
          status?: string | null
          yard_location?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          id?: string
          location_address?: string | null
          size?: string
          skip_id?: string
          status?: string | null
          yard_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skips_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tare_weights: {
        Row: {
          id: string
          lorry_registration: string
          skip_size: string
          tare_weight: number
        }
        Insert: {
          id?: string
          lorry_registration: string
          skip_size: string
          tare_weight: number
        }
        Update: {
          id?: string
          lorry_registration?: string
          skip_size?: string
          tare_weight?: number
        }
        Relationships: []
      }
      vehicle_checks: {
        Row: {
          check_data: Json | null
          created_at: string | null
          defects_reported: string | null
          driver_name: string | null
          id: string
          lorry_reg: string | null
          odometer: number | null
          status: string | null
        }
        Insert: {
          check_data?: Json | null
          created_at?: string | null
          defects_reported?: string | null
          driver_name?: string | null
          id?: string
          lorry_reg?: string | null
          odometer?: number | null
          status?: string | null
        }
        Update: {
          check_data?: Json | null
          created_at?: string | null
          defects_reported?: string | null
          driver_name?: string | null
          id?: string
          lorry_reg?: string | null
          odometer?: number | null
          status?: string | null
        }
        Relationships: []
      }
      vehicle_maintenance: {
        Row: {
          certificate_ref: string | null
          cost: number | null
          created_at: string | null
          created_by: string | null
          date: string
          description: string | null
          id: string
          maintenance_type: string
          mileage: number | null
          next_due_date: string | null
          performed_by: string | null
          vehicle_reg: string
        }
        Insert: {
          certificate_ref?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          maintenance_type: string
          mileage?: number | null
          next_due_date?: string | null
          performed_by?: string | null
          vehicle_reg: string
        }
        Update: {
          certificate_ref?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          maintenance_type?: string
          mileage?: number | null
          next_due_date?: string | null
          performed_by?: string | null
          vehicle_reg?: string
        }
        Relationships: []
      }
      vehicle_telemetry: {
        Row: {
          created_at: string | null
          heading: number | null
          id: string
          latitude: number
          longitude: number
          speed: number | null
          vehicle_reg: string
        }
        Insert: {
          created_at?: string | null
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          speed?: number | null
          vehicle_reg: string
        }
        Update: {
          created_at?: string | null
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          speed?: number | null
          vehicle_reg?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          created_at: string | null
          current_driver_id: string | null
          current_load: Json | null
          heading: number | null
          home_base_lat: number | null
          home_base_lng: number | null
          id: string
          last_updated: string | null
          latitude: number | null
          longitude: number | null
          max_skip_slots: number | null
          registration: string
          speed: number | null
          stack_rules: Json | null
          status: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          current_driver_id?: string | null
          current_load?: Json | null
          heading?: number | null
          home_base_lat?: number | null
          home_base_lng?: number | null
          id?: string
          last_updated?: string | null
          latitude?: number | null
          longitude?: number | null
          max_skip_slots?: number | null
          registration: string
          speed?: number | null
          stack_rules?: Json | null
          status?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          current_driver_id?: string | null
          current_load?: Json | null
          heading?: number | null
          home_base_lat?: number | null
          home_base_lng?: number | null
          id?: string
          last_updated?: string | null
          latitude?: number | null
          longitude?: number | null
          max_skip_slots?: number | null
          registration?: string
          speed?: number | null
          stack_rules?: Json | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_current_driver_id_fkey"
            columns: ["current_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      walkaround_checks: {
        Row: {
          checks: Json | null
          date: string | null
          driver_id: string | null
          driver_name: string | null
          has_defects: boolean | null
          id: string
          notes: string | null
          submitted_at: string | null
          vehicle_id: string | null
          vehicle_reg: string | null
        }
        Insert: {
          checks?: Json | null
          date?: string | null
          driver_id?: string | null
          driver_name?: string | null
          has_defects?: boolean | null
          id?: string
          notes?: string | null
          submitted_at?: string | null
          vehicle_id?: string | null
          vehicle_reg?: string | null
        }
        Update: {
          checks?: Json | null
          date?: string | null
          driver_id?: string | null
          driver_name?: string | null
          has_defects?: boolean | null
          id?: string
          notes?: string | null
          submitted_at?: string | null
          vehicle_id?: string | null
          vehicle_reg?: string | null
        }
        Relationships: []
      }
      waste_transfer_notes: {
        Row: {
          created_at: string | null
          ewc_code: string | null
          id: string
          notes: string | null
          order_id: string | null
          quantity_description: string | null
          quantity_kg: number | null
          transfer_date: string
          transferee_address: string | null
          transferee_name: string
          transferee_registration: string | null
          transferor_address: string | null
          transferor_name: string
          transferor_registration: string | null
          vehicle_reg: string | null
          waste_description: string
          weight_log_id: string | null
          wtn_number: string
        }
        Insert: {
          created_at?: string | null
          ewc_code?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          quantity_description?: string | null
          quantity_kg?: number | null
          transfer_date: string
          transferee_address?: string | null
          transferee_name?: string
          transferee_registration?: string | null
          transferor_address?: string | null
          transferor_name: string
          transferor_registration?: string | null
          vehicle_reg?: string | null
          waste_description: string
          weight_log_id?: string | null
          wtn_number?: string
        }
        Update: {
          created_at?: string | null
          ewc_code?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          quantity_description?: string | null
          quantity_kg?: number | null
          transfer_date?: string
          transferee_address?: string | null
          transferee_name?: string
          transferee_registration?: string | null
          transferor_address?: string | null
          transferor_name?: string
          transferor_registration?: string | null
          vehicle_reg?: string | null
          waste_description?: string
          weight_log_id?: string | null
          wtn_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_transfer_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_transfer_notes_weight_log_id_fkey"
            columns: ["weight_log_id"]
            isOneToOne: false
            referencedRelation: "weight_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      weighbridge_readings: {
        Row: {
          description: string | null
          id: string
          reg_number: string | null
          timestamp: string | null
          weight_kg: number | null
        }
        Insert: {
          description?: string | null
          id?: string
          reg_number?: string | null
          timestamp?: string | null
          weight_kg?: number | null
        }
        Update: {
          description?: string | null
          id?: string
          reg_number?: string | null
          timestamp?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          address: string | null
          customer_name: string
          direction: string | null
          ewc_code: string | null
          ewc_code_id: string | null
          gross_weight: number | null
          id: string
          logged_at: string | null
          lorry_reg: string | null
          net_weight: number | null
          notes: string | null
          skip_id: string | null
          skip_size: string | null
          tare_weight: number | null
          ticket_number: string | null
          waste_type: string | null
        }
        Insert: {
          address?: string | null
          customer_name: string
          direction?: string | null
          ewc_code?: string | null
          ewc_code_id?: string | null
          gross_weight?: number | null
          id?: string
          logged_at?: string | null
          lorry_reg?: string | null
          net_weight?: number | null
          notes?: string | null
          skip_id?: string | null
          skip_size?: string | null
          tare_weight?: number | null
          ticket_number?: string | null
          waste_type?: string | null
        }
        Update: {
          address?: string | null
          customer_name?: string
          direction?: string | null
          ewc_code?: string | null
          ewc_code_id?: string | null
          gross_weight?: number | null
          id?: string
          logged_at?: string | null
          lorry_reg?: string | null
          net_weight?: number | null
          notes?: string | null
          skip_id?: string | null
          skip_size?: string | null
          tare_weight?: number | null
          ticket_number?: string | null
          waste_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_ewc_code_id_fkey"
            columns: ["ewc_code_id"]
            isOneToOne: false
            referencedRelation: "ewc_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      yard_staff: {
        Row: {
          created_at: string | null
          id: string
          name: string
          pay_rate: number | null
          pin: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          pay_rate?: number | null
          pin: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          pay_rate?: number | null
          pin?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_collections_due: {
        Row: {
          address: string | null
          customer_name: string | null
          days_on_hire: number | null
          delivery_date: string | null
          skip_id: string | null
          skip_size: string | null
        }
        Insert: {
          address?: string | null
          customer_name?: string | null
          days_on_hire?: never
          delivery_date?: string | null
          skip_id?: string | null
          skip_size?: string | null
        }
        Update: {
          address?: string | null
          customer_name?: string | null
          days_on_hire?: never
          delivery_date?: string | null
          skip_id?: string | null
          skip_size?: string | null
        }
        Relationships: []
      }
      v_dashboard_stats: {
        Row: {
          completed_today: number | null
          completed_week: number | null
          future_bookings: number | null
        }
        Relationships: []
      }
      v_driver_hours_today: {
        Row: {
          current_lorry: string | null
          currently_clocked_in: boolean | null
          driver_name: string | null
          hours_today: number | null
          last_clock_in: string | null
        }
        Relationships: []
      }
      v_inventory_summary: {
        Row: {
          available: number | null
          damaged: number | null
          out_on_hire: number | null
          skip_size: string | null
          total: number | null
        }
        Relationships: []
      }
      v_tips_today: {
        Row: {
          tips_today: number | null
        }
        Relationships: []
      }
      v_unpaid_invoices: {
        Row: {
          address: string | null
          amount: number | null
          customer_name: string | null
          date: string | null
          id: string | null
          skip_id: string | null
          source: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      job_type:
        | "Delivery"
        | "Exchange"
        | "Collection"
        | "Wait & Load"
        | "Cage Load"
      order_status:
        | "Booked"
        | "Assigned"
        | "Out for Delivery"
        | "Completed"
        | "Cancelled"
        | "Aborted"
      payment_method: "Invoice" | "Cash" | "Card"
      skip_status:
        | "Available"
        | "Delivered"
        | "In Use"
        | "Damaged"
        | "Decommissioned"
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
      job_type: [
        "Delivery",
        "Exchange",
        "Collection",
        "Wait & Load",
        "Cage Load",
      ],
      order_status: [
        "Booked",
        "Assigned",
        "Out for Delivery",
        "Completed",
        "Cancelled",
        "Aborted",
      ],
      payment_method: ["Invoice", "Cash", "Card"],
      skip_status: [
        "Available",
        "Delivered",
        "In Use",
        "Damaged",
        "Decommissioned",
      ],
    },
  },
} as const

