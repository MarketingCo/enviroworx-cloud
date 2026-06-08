import { supabaseAdmin } from '@/lib/supabase'

/** Merge tenant_id into any insert/upsert payload */
export function withTenant<T extends object>(tenantId: string, payload: T): T & { tenant_id: string } {
  return { ...payload, tenant_id: tenantId }
}

/** Scope a select/update/delete query to a tenant */
export function tenantScope(tenantId: string) {
  return {
    from: (table: string) => (supabaseAdmin as any).from(table).eq('tenant_id', tenantId)
  }
}
