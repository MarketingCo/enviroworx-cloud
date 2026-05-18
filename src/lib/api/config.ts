/**
 * CUSTOM PRICING (makes custom_pricing table work in calculations)
 * + CONFIG MANAGEMENT
 */
import { supabase } from '../supabase'
import type { Json } from '../database.types'

// ── Config Management ────────────────────────────────────────

export async function updateConfig(key: string, value: Json) {
  const { error } = await supabase.from('config').upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw error
  return { success: true }
}

// ── Custom Pricing ───────────────────────────────────────────

export async function getCustomPricingList() {
  const { data } = await supabase.from('custom_pricing').select('*').order('customer_name')
  return data ?? []
}

export async function addCustomPrice(payload: { customer_name: string; skip_size?: string; waste_type?: string; net_price: number }) {
  const { error } = await supabase.from('custom_pricing').insert(payload)
  if (error) throw error
  return { success: true }
}

export async function deleteCustomPrice(id: string) {
  const { error } = await supabase.from('custom_pricing').delete().eq('id', id)
  if (error) throw error
  return { success: true }
}

export async function getCustomerPrice(customerName: string, skipSize?: string, wasteType?: string, customerId?: string): Promise<number | null> {
  let query = supabase
    .from('custom_pricing')
    .select('net_price')

  // Phase 9: use customer_id FK when available, fallback to name ilike
  if (customerId) {
    // Note: custom_pricing should add customer_id column in future migration
    // For now, fall through to name-based lookup
    query = query.ilike('customer_name', customerName.trim())
  } else {
    query = query.ilike('customer_name', customerName.trim())
  }

  if (skipSize) query = query.eq('skip_size', skipSize)
  if (wasteType) query = query.eq('waste_type', wasteType)

  const { data } = await query.limit(1).single()
  return data?.net_price ?? null
}
