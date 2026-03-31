export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          billing_address: string | null
          email: string | null
          invoice_type: string | null
          full_name: string | null
          shipping_address: string | null
          account_balance: number | null
          comments: string | null
          portal_pin: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          billing_address?: string | null
          email?: string | null
          invoice_type?: string | null
          full_name?: string | null
          shipping_address?: string | null
          account_balance?: number | null
          comments?: string | null
          portal_pin?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          billing_address?: string | null
          email?: string | null
          invoice_type?: string | null
          full_name?: string | null
          shipping_address?: string | null
          account_balance?: number | null
          comments?: string | null
          portal_pin?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      orders: {
        Row: {
          id: string
          date: string
          status: 'Booked' | 'Assigned' | 'Out for Delivery' | 'Completed' | 'Cancelled' | 'Aborted'
          skip_size: string
          job_type: 'Delivery' | 'Exchange' | 'Collection' | 'Wait & Load' | 'Cage Load'
          address: string
          customer_id: string | null
          customer_name: string
          phone: string | null
          driver_name: string | null
          driver_id: string | null
          payment_method: 'Invoice' | 'Cash' | 'Card' | null
          paid: boolean
          delivery_comments: string | null
          photo_proof: string | null
          voice_note_url: string | null
          arrive_time: string | null
          skip_id_used: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          date: string
          status?: 'Booked' | 'Assigned' | 'Out for Delivery' | 'Completed' | 'Cancelled' | 'Aborted'
          skip_size: string
          job_type: 'Delivery' | 'Exchange' | 'Collection' | 'Wait & Load' | 'Cage Load'
          address: string
          customer_id?: string | null
          customer_name: string
          phone?: string | null
          driver_name?: string | null
          driver_id?: string | null
          payment_method?: 'Invoice' | 'Cash' | 'Card' | null
          paid?: boolean
          delivery_comments?: string | null
          photo_proof?: string | null
          voice_note_url?: string | null
          arrive_time?: string | null
          skip_id_used?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          date?: string
          status?: 'Booked' | 'Assigned' | 'Out for Delivery' | 'Completed' | 'Cancelled' | 'Aborted'
          skip_size?: string
          job_type?: 'Delivery' | 'Exchange' | 'Collection' | 'Wait & Load' | 'Cage Load'
          address?: string
          customer_id?: string | null
          customer_name?: string
          phone?: string | null
          driver_name?: string | null
          driver_id?: string | null
          payment_method?: 'Invoice' | 'Cash' | 'Card' | null
          paid?: boolean
          delivery_comments?: string | null
          photo_proof?: string | null
          voice_note_url?: string | null
          arrive_time?: string | null
          skip_id_used?: string | null
          created_at?: string | null
        }
      }
      drivers: {
        Row: {
          id: string
          name: string
          status: 'Available' | 'Off' | 'Office' | 'On Route'
          pin: string | null
          pay_rate: number | null
          auth_user_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          status?: 'Available' | 'Off' | 'Office' | 'On Route'
          pin?: string | null
          pay_rate?: number | null
          auth_user_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          status?: 'Available' | 'Off' | 'Office' | 'On Route'
          pin?: string | null
          pay_rate?: number | null
          auth_user_id?: string | null
          created_at?: string | null
        }
      }
      inventory: {
        Row: {
          id: string
          skip_id: string
          skip_size: string
          status: 'Available' | 'Delivered' | 'In Use' | 'Damaged' | 'Decommissioned'
          delivery_address: string | null
          delivery_date: string | null
          customer_name: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          skip_id: string
          skip_size: string
          status?: 'Available' | 'Delivered' | 'In Use' | 'Damaged' | 'Decommissioned'
          delivery_address?: string | null
          delivery_date?: string | null
          customer_name?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          skip_id?: string
          skip_size?: string
          status?: 'Available' | 'Delivered' | 'In Use' | 'Damaged' | 'Decommissioned'
          delivery_address?: string | null
          delivery_date?: string | null
          customer_name?: string | null
          created_at?: string | null
        }
      }
      active_tippers: {
        Row: {
          id: string
          reg: string
          customer_name: string
          waste_type: string
          gross_weight: number
          address: string
          skip_size: string
          skip_id: string | null
          timestamp: string
        }
        Insert: {
          id?: string
          reg: string
          customer_name: string
          waste_type: string
          gross_weight?: number
          address?: string
          skip_size: string
          skip_id?: string | null
          timestamp?: string
        }
        Update: {
          id?: string
          reg?: string
          customer_name?: string
          waste_type?: string
          gross_weight?: number
          address?: string
          skip_size?: string
          skip_id?: string | null
          timestamp?: string
        }
      }
    }
    Views: {
      v_inventory_summary: {
        Row: {
          skip_size: string
          total: number
          available: number
          in_use: number
          damaged: number
        }
      }
      v_unpaid_invoices: {
        Row: {
          id: string
          customer_name: string
          address: string
          amount: number
          source: 'Orders' | 'CashLog'
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      order_status: 'Booked' | 'Assigned' | 'Out for Delivery' | 'Completed' | 'Cancelled' | 'Aborted'
      job_type: 'Delivery' | 'Exchange' | 'Collection' | 'Wait & Load' | 'Cage Load'
      payment_method: 'Invoice' | 'Cash' | 'Card'
      skip_status: 'Available' | 'Delivered' | 'In Use' | 'Damaged' | 'Decommissioned'
      lorry_status: 'Available' | 'In Use' | 'Maintenance' | 'Off Road'
      driver_status: 'Available' | 'Off' | 'Office' | 'On Route'
      waste_type: 'Mix Con' | 'Mix Mun' | 'Wood' | 'Inert' | 'Soil' | 'Cardboard' | 'Metal' | 'TBC'
    }
  }
}
