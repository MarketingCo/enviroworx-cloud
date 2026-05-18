export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      active_tippers: {
        Row: { address: string | null; customer_name: string | null; gross_weight: number | null; id: string; reg: string; skip_id: string | null; skip_size: string | null; timestamp: string | null; waste_type: string | null }
        Insert: { address?: string | null; customer_name?: string | null; gross_weight?: number | null; id?: string; reg: string; skip_id?: string | null; skip_size?: string | null; timestamp?: string | null; waste_type?: string | null }
        Update: { address?: string | null; customer_name?: string | null; gross_weight?: number | null; id?: string; reg?: string; skip_id?: string | null; skip_size?: string | null; timestamp?: string | null; waste_type?: string | null }
        Relationships: []
      }
      external_map_points: {
        Row: { created_at: string | null; description: string | null; folder: string | null; id: string; latitude: number; longitude: number; metadata: Json | null; name: string; style_url: string | null; updated_at: string | null }
        Insert: { created_at?: string | null; description?: string | null; folder?: string | null; id?: string; latitude: number; longitude: number; metadata?: Json | null; name: string; style_url?: string | null; updated_at?: string | null }
        Update: { created_at?: string | null; description?: string | null; folder?: string | null; id?: string; latitude?: number; longitude?: number; metadata?: Json | null; name?: string; style_url?: string | null; updated_at?: string | null }
        Relationships: []
      }
      archive_orders: {
        Row: { archived_at: string | null; data: Json | null; id: string; original_id: string | null }
        Insert: { archived_at?: string | null; data?: Json | null; id?: string; original_id?: string | null }
        Update: { archived_at?: string | null; data?: Json | null; id?: string; original_id?: string | null }
        Relationships: []
      }
      cash_log: {
        Row: { address: string | null; amount_paid: number | null; comments: string | null; cost_gross: number | null; cost_net: number | null; created_at: string | null; customer_name: string; gross_weight: number | null; id: string; logged_at: string | null; net_weight: number | null; payment_method: Database["public"]["Enums"]["payment_method"] | null; skip_size: string | null; ticket_number: string | null; tyl_ref: string | null; waste_type: string | null }
        Insert: { address?: string | null; amount_paid?: number | null; comments?: string | null; cost_gross?: number | null; cost_net?: number | null; created_at?: string | null; customer_name: string; gross_weight?: number | null; id?: string; logged_at?: string | null; net_weight?: number | null; payment_method?: Database["public"]["Enums"]["payment_method"] | null; skip_size?: string | null; ticket_number?: string | null; tyl_ref?: string | null; waste_type?: string | null }
        Update: { address?: string | null; amount_paid?: number | null; comments?: string | null; cost_gross?: number | null; cost_net?: number | null; created_at?: string | null; customer_name?: string; gross_weight?: number | null; id?: string; logged_at?: string | null; net_weight?: number | null; payment_method?: Database["public"]["Enums"]["payment_method"] | null; skip_size?: string | null; ticket_number?: string | null; tyl_ref?: string | null; waste_type?: string | null }
        Relationships: []
      }
      config: {
        Row: { key: string; updated_at: string | null; value: Json | null }
        Insert: { key: string; updated_at?: string | null; value?: Json | null }
        Update: { key?: string; updated_at?: string | null; value?: Json | null }
        Relationships: []
      }
      custom_pricing: {
        Row: { created_at: string | null; customer_name: string; id: string; net_price: number; skip_size: string | null; waste_type: string | null }
        Insert: { created_at?: string | null; customer_name: string; id?: string; net_price: number; skip_size?: string | null; waste_type?: string | null }
        Update: { created_at?: string | null; customer_name?: string; id?: string; net_price?: number; skip_size?: string | null; waste_type?: string | null }
        Relationships: []
      }
      customers: {
        Row: { account_balance: number | null; billing_address: string | null; comments: string | null; created_at: string | null; email: string | null; full_name: string | null; id: string; invoice_type: string | null; name: string; phone: string | null; portal_pin: string | null; shipping_address: string | null; updated_at: string | null }
        Insert: { account_balance?: number | null; billing_address?: string | null; comments?: string | null; created_at?: string | null; email?: string | null; full_name?: string | null; id?: string; invoice_type?: string | null; name: string; phone?: string | null; portal_pin?: string | null; shipping_address?: string | null; updated_at?: string | null }
        Update: { account_balance?: number | null; billing_address?: string | null; comments?: string | null; created_at?: string | null; email?: string | null; full_name?: string | null; id?: string; invoice_type?: string | null; name?: string; phone?: string | null; portal_pin?: string | null; shipping_address?: string | null; updated_at?: string | null }
        Relationships: []
      }
      driver_hours: {
        Row: { break_minutes: number | null; clock_in: string | null; clock_out: string | null; created_at: string | null; date: string | null; driver_id: string | null; driver_name: string | null; hours_worked: number | null; id: string; vehicle_id: string | null; vehicle_reg: string | null }
        Insert: { break_minutes?: number | null; clock_in?: string | null; clock_out?: string | null; created_at?: string | null; date?: string | null; driver_id?: string | null; driver_name?: string | null; hours_worked?: number | null; id?: string; vehicle_id?: string | null; vehicle_reg?: string | null }
        Update: { break_minutes?: number | null; clock_in?: string | null; clock_out?: string | null; created_at?: string | null; date?: string | null; driver_id?: string | null; driver_name?: string | null; hours_worked?: number | null; id?: string; vehicle_id?: string | null; vehicle_reg?: string | null }
        Relationships: []
      }
      drivers: {
        Row: { created_at: string | null; id: string; name: string; pay_rate: number | null; pin: string | null; status: string | null; updated_at: string | null }
        Insert: { created_at?: string | null; id?: string; name: string; pay_rate?: number | null; pin?: string | null; status?: string | null; updated_at?: string | null }
        Update: { created_at?: string | null; id?: string; name?: string; pay_rate?: number | null; pin?: string | null; status?: string | null; updated_at?: string | null }
        Relationships: []
      }
      fleet_logs: {
        Row: { created_at: string | null; description: string | null; id: string; issue_type: string; lorry_reg: string; photo_url: string | null; reported_by: string | null; status: string | null; timestamp: string | null }
        Insert: { created_at?: string | null; description?: string | null; id?: string; issue_type: string; lorry_reg: string; photo_url?: string | null; reported_by?: string | null; status?: string | null; timestamp?: string | null }
        Update: { created_at?: string | null; description?: string | null; id?: string; issue_type?: string; lorry_reg?: string; photo_url?: string | null; reported_by?: string | null; status?: string | null; timestamp?: string | null }
        Relationships: []
      }
      fuel_cards: {
        Row: { id: string; pin: string | null; reg: string | null }
        Insert: { id?: string; pin?: string | null; reg?: string | null }
        Update: { id?: string; pin?: string | null; reg?: string | null }
        Relationships: []
      }
      hr_logs: {
        Row: { category: string; employee: string; id: string; notes: string | null; timestamp: string | null }
        Insert: { category: string; employee: string; id?: string; notes?: string | null; timestamp?: string | null }
        Update: { category?: string; employee?: string; id?: string; notes?: string | null; timestamp?: string | null }
        Relationships: []
      }
      incidents: {
        Row: { description: string | null; driver_name: string | null; id: string; location: string | null; photo_url: string | null; reported_at: string | null; type: string | null; vehicle_reg: string | null }
        Insert: { description?: string | null; driver_name?: string | null; id?: string; location?: string | null; photo_url?: string | null; reported_at?: string | null; type?: string | null; vehicle_reg?: string | null }
        Update: { description?: string | null; driver_name?: string | null; id?: string; location?: string | null; photo_url?: string | null; reported_at?: string | null; type?: string | null; vehicle_reg?: string | null }
        Relationships: []
      }
      inventory: {
        Row: { comments: string | null; created_at: string | null; customer_id: string | null; customer_name: string | null; customer_phone: string | null; customer_request: string | null; date_booked: string | null; delivery_address: string | null; delivery_date: string | null; id: string; lorry_type: string | null; payment_method: string | null; payment_status: string | null; priority_score: number | null; scheduled_return_date: string | null; skip_id: string; skip_size: string; status: string | null; ticket_number: string | null; updated_at: string | null }
        Insert: { comments?: string | null; created_at?: string | null; customer_id?: string | null; customer_name?: string | null; customer_phone?: string | null; customer_request?: string | null; date_booked?: string | null; delivery_address?: string | null; delivery_date?: string | null; id?: string; lorry_type?: string | null; payment_method?: string | null; payment_status?: string | null; priority_score?: number | null; scheduled_return_date?: string | null; skip_id: string; skip_size: string; status?: string | null; ticket_number?: string | null; updated_at?: string | null }
        Update: { comments?: string | null; created_at?: string | null; customer_id?: string | null; customer_name?: string | null; customer_phone?: string | null; customer_request?: string | null; date_booked?: string | null; delivery_address?: string | null; delivery_date?: string | null; id?: string; lorry_type?: string | null; payment_method?: string | null; payment_status?: string | null; priority_score?: number | null; scheduled_return_date?: string | null; skip_id?: string; skip_size?: string; status?: string | null; ticket_number?: string | null; updated_at?: string | null }
        Relationships: [{ foreignKeyName: "inventory_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] }]
      }
      lorries: {
        Row: { created_at: string | null; id: string; registration: string; status: string | null }
        Insert: { created_at?: string | null; id?: string; registration: string; status?: string | null }
        Update: { created_at?: string | null; id?: string; registration?: string; status?: string | null }
        Relationships: []
      }
      orders: {
        Row: { address: string; arrive_time: string | null; comments: string | null; created_at: string | null; customer_id: string | null; customer_name: string; date: string; delivery_comments: string | null; depart_time: string | null; driver_id: string | null; driver_name: string | null; id: string; in_diary: boolean | null; job_type: Database["public"]["Enums"]["job_type"]; latitude: number | null; longitude: number | null; on_map: boolean | null; paid: boolean | null; payment_method: Database["public"]["Enums"]["payment_method"] | null; phone: string | null; photo_proof: string | null; signature_proof: string | null; skip_id_used: string | null; skip_size: string; status: string | null; updated_at: string | null; voice_note_url: string | null }
        Insert: { address: string; arrive_time?: string | null; comments?: string | null; created_at?: string | null; customer_id?: string | null; customer_name: string; date: string; delivery_comments?: string | null; depart_time?: string | null; driver_id?: string | null; driver_name?: string | null; id?: string; in_diary?: boolean | null; job_type: Database["public"]["Enums"]["job_type"]; latitude?: number | null; longitude?: number | null; on_map?: boolean | null; paid?: boolean | null; payment_method?: Database["public"]["Enums"]["payment_method"] | null; phone?: string | null; photo_proof?: string | null; signature_proof?: string | null; skip_id_used?: string | null; skip_size: string; status?: string | null; updated_at?: string | null; voice_note_url?: string | null }
        Update: { address?: string; arrive_time?: string | null; comments?: string | null; created_at?: string | null; customer_id?: string | null; customer_name?: string; date?: string; delivery_comments?: string | null; depart_time?: string | null; driver_id?: string | null; driver_name?: string | null; id?: string; in_diary?: boolean | null; job_type?: Database["public"]["Enums"]["job_type"]; latitude?: number | null; longitude?: number | null; on_map?: boolean | null; paid?: boolean | null; payment_method?: Database["public"]["Enums"]["payment_method"] | null; phone?: string | null; photo_proof?: string | null; signature_proof?: string | null; skip_id_used?: string | null; skip_size?: string; status?: string | null; updated_at?: string | null; voice_note_url?: string | null }
        Relationships: [{ foreignKeyName: "orders_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] }]
      }
      permits: {
        Row: { created_at: string | null; date_applied: string | null; date_issued: string | null; expiry_date: string; id: string; location: string; permit_number: string | null; skip_id: string; status: string | null }
        Insert: { created_at?: string | null; date_applied?: string | null; date_issued?: string | null; expiry_date: string; id?: string; location: string; permit_number?: string | null; skip_id: string; status?: string | null }
        Update: { created_at?: string | null; date_applied?: string | null; date_issued?: string | null; expiry_date?: string; id?: string; location?: string; permit_number?: string | null; skip_id?: string; status?: string | null }
        Relationships: []
      }
      shifts: {
        Row: { break_mins: number | null; clock_in: string | null; clock_out: string | null; created_at: string | null; date: string; employee: string; id: string; notes: string | null; payable_hours: number | null; role_or_lorry: string | null; total_mins: number | null }
        Insert: { break_mins?: number | null; clock_in?: string | null; clock_out?: string | null; created_at?: string | null; date: string; employee: string; id?: string; notes?: string | null; payable_hours?: number | null; role_or_lorry?: string | null; total_mins?: number | null }
        Update: { break_mins?: number | null; clock_in?: string | null; clock_out?: string | null; created_at?: string | null; date?: string; employee?: string; id?: string; notes?: string | null; payable_hours?: number | null; role_or_lorry?: string | null; total_mins?: number | null }
        Relationships: []
      }
      skip_combos: {
        Row: { combination: string; id: string }
        Insert: { combination: string; id?: string }
        Update: { combination?: string; id?: string }
        Relationships: []
      }
      tare_weights: {
        Row: { id: string; lorry_registration: string; skip_size: string; tare_weight: number }
        Insert: { id?: string; lorry_registration: string; skip_size: string; tare_weight: number }
        Update: { id?: string; lorry_registration?: string; skip_size?: string; tare_weight?: number }
        Relationships: []
      }
      vehicle_checks: {
        Row: { check_data: Json | null; created_at: string | null; defects_reported: string | null; driver_name: string | null; id: string; lorry_reg: string | null; odometer: number | null; status: string | null }
        Insert: { check_data?: Json | null; created_at?: string | null; defects_reported?: string | null; driver_name?: string | null; id?: string; lorry_reg?: string | null; odometer?: number | null; status?: string | null }
        Update: { check_data?: Json | null; created_at?: string | null; defects_reported?: string | null; driver_name?: string | null; id?: string; lorry_reg?: string | null; odometer?: number | null; status?: string | null }
        Relationships: []
      }
      vehicle_maintenance: {
        Row: { certificate_ref: string | null; cost: number | null; created_at: string | null; created_by: string | null; date: string; description: string | null; id: string; maintenance_type: string; mileage: number | null; next_due_date: string | null; performed_by: string | null; vehicle_reg: string }
        Insert: { certificate_ref?: string | null; cost?: number | null; created_at?: string | null; created_by?: string | null; date: string; description?: string | null; id?: string; maintenance_type: string; mileage?: number | null; next_due_date?: string | null; performed_by?: string | null; vehicle_reg: string }
        Update: { certificate_ref?: string | null; cost?: number | null; created_at?: string | null; created_by?: string | null; date?: string; description?: string | null; id?: string; maintenance_type?: string; mileage?: number | null; next_due_date?: string | null; performed_by?: string | null; vehicle_reg?: string }
        Relationships: []
      }
      vehicles: {
        Row: { active: boolean | null; created_at: string | null; heading: number | null; id: string; insurance_expiry: string | null; last_6weekly_date: string | null; last_service_date: string | null; last_service_mileage: number | null; last_updated: string | null; latitude: number | null; longitude: number | null; mot_due: string | null; name: string | null; notes: string | null; operator_licence: string | null; reg: string; speed: number | null; tare_weight: number | null; tax_due: string | null; type: string | null; verizon_vehicle_number: string | null }
        Insert: { active?: boolean | null; created_at?: string | null; heading?: number | null; id?: string; insurance_expiry?: string | null; last_6weekly_date?: string | null; last_service_date?: string | null; last_service_mileage?: number | null; last_updated?: string | null; latitude?: number | null; longitude?: number | null; mot_due?: string | null; name?: string | null; notes?: string | null; operator_licence?: string | null; reg: string; speed?: number | null; tare_weight?: number | null; tax_due?: string | null; type?: string | null; verizon_vehicle_number?: string | null }
        Update: { active?: boolean | null; created_at?: string | null; heading?: number | null; id?: string; insurance_expiry?: string | null; last_6weekly_date?: string | null; last_service_date?: string | null; last_service_mileage?: number | null; last_updated?: string | null; latitude?: number | null; longitude?: number | null; mot_due?: string | null; name?: string | null; notes?: string | null; operator_licence?: string | null; reg?: string; speed?: number | null; tare_weight?: number | null; tax_due?: string | null; type?: string | null; verizon_vehicle_number?: string | null }
        Relationships: []
      }
      walkaround_checks: {
        Row: { checks: Json | null; date: string | null; driver_id: string | null; driver_name: string | null; has_defects: boolean | null; id: string; notes: string | null; submitted_at: string | null; vehicle_id: string | null; vehicle_reg: string | null }
        Insert: { checks?: Json | null; date?: string | null; driver_id?: string | null; driver_name?: string | null; has_defects?: boolean | null; id?: string; notes?: string | null; submitted_at?: string | null; vehicle_id?: string | null; vehicle_reg?: string | null }
        Update: { checks?: Json | null; date?: string | null; driver_id?: string | null; driver_name?: string | null; has_defects?: boolean | null; id?: string; notes?: string | null; submitted_at?: string | null; vehicle_id?: string | null; vehicle_reg?: string | null }
        Relationships: []
      }
      activity_log: {
        Row: { id: string; created_at: string | null; type: string | null; message: string | null; status: string | null }
        Insert: { id?: string; created_at?: string | null; type?: string | null; message?: string | null; status?: string | null }
        Update: { id?: string; created_at?: string | null; type?: string | null; message?: string | null; status?: string | null }
        Relationships: []
      }
      vehicle_telemetry: {
        Row: { id: string; created_at: string | null; vehicle_reg: string | null; latitude: number | null; longitude: number | null; speed: number | null; heading: number | null }
        Insert: { id?: string; created_at?: string | null; vehicle_reg?: string | null; latitude?: number | null; longitude?: number | null; speed?: number | null; heading?: number | null }
        Update: { id?: string; created_at?: string | null; vehicle_reg?: string | null; latitude?: number | null; longitude?: number | null; speed?: number | null; heading?: number | null }
        Relationships: []
      }
      weighbridge_readings: {
        Row: { description: string | null; id: string; reg_number: string | null; timestamp: string | null; weight_kg: number | null }
        Insert: { description?: string | null; id?: string; reg_number?: string | null; timestamp?: string | null; weight_kg?: number | null }
        Update: { description?: string | null; id?: string; reg_number?: string | null; timestamp?: string | null; weight_kg?: number | null }
        Relationships: []
      }
      weight_logs: {
        Row: { address: string | null; customer_name: string; gross_weight: number | null; id: string; logged_at: string | null; lorry_reg: string | null; net_weight: number | null; notes: string | null; skip_id: string | null; skip_size: string | null; tare_weight: number | null; ticket_number: string | null; waste_type: string | null }
        Insert: { address?: string | null; customer_name: string; gross_weight?: number | null; id?: string; logged_at?: string | null; lorry_reg?: string | null; net_weight?: number | null; notes?: string | null; skip_id?: string | null; skip_size?: string | null; tare_weight?: number | null; ticket_number?: string | null; waste_type?: string | null }
        Update: { address?: string | null; customer_name?: string; gross_weight?: number | null; id?: string; logged_at?: string | null; lorry_reg?: string | null; net_weight?: number | null; notes?: string | null; skip_id?: string | null; skip_size?: string | null; tare_weight?: number | null; ticket_number?: string | null; waste_type?: string | null }
        Relationships: []
      }
      yard_staff: {
        Row: { created_at: string | null; id: string; name: string; pay_rate: number | null; pin: string }
        Insert: { created_at?: string | null; id?: string; name: string; pay_rate?: number | null; pin: string }
        Update: { created_at?: string | null; id?: string; name?: string; pay_rate?: number | null; pin?: string }
        Relationships: []
      }
    }
    Views: {
      v_collections_due: {
        Row: { address: string | null; customer_name: string | null; days_on_hire: number | null; delivery_date: string | null; skip_id: string | null; skip_size: string | null }
        Relationships: []
      }
      v_driver_hours_today: {
        Row: { current_lorry: string | null; currently_clocked_in: boolean | null; driver_name: string | null; hours_today: number | null; last_clock_in: string | null }
        Relationships: []
      }
      v_inventory_summary: {
        Row: { available: number | null; damaged: number | null; out_on_hire: number | null; skip_size: string | null; total: number | null }
        Relationships: []
      }
      v_unpaid_invoices: {
        Row: { address: string | null; amount: number | null; customer_name: string | null; date: string | null; id: string | null; skip_id: string | null; source: string | null }
        Relationships: []
      }
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      job_type: "Delivery" | "Exchange" | "Collection" | "Wait & Load" | "Cage Load"
      order_status: "Booked" | "Assigned" | "Out for Delivery" | "Completed" | "Cancelled" | "Aborted"
      payment_method: "Invoice" | "Cash" | "Card"
      skip_status: "Available" | "Delivered" | "In Use" | "Damaged" | "Decommissioned"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends { Row: infer R } ? R : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends { Row: infer R } ? R : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I } ? I : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I } ? I : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U } ? U : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U } ? U : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      job_type: ["Delivery", "Exchange", "Collection", "Wait & Load", "Cage Load"],
      order_status: ["Booked", "Assigned", "Out for Delivery", "Completed", "Cancelled", "Aborted"],
      payment_method: ["Invoice", "Cash", "Card"],
      skip_status: ["Available", "Delivered", "In Use", "Damaged", "Decommissioned"],
    },
  },
} as const
