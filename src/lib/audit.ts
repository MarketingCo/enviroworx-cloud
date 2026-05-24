import { supabaseAdmin } from '@/lib/supabase'
import type { AppSession } from '@/lib/session'

export type AuditPayload = {
  type: string
  message: string
  status?: string
  actorEmail?: string | null
  actorName?: string | null
  entityType?: string | null
  entityId?: string | null
  metadata?: Record<string, unknown> | null
}

export async function writeAudit(payload: AuditPayload) {
  try {
    await supabaseAdmin.from('activity_log').insert({
      type: payload.type,
      message: payload.message,
      status: payload.status ?? 'ok',
      actor_email: payload.actorEmail ?? null,
      actor_name: payload.actorName ?? null,
      entity_type: payload.entityType ?? null,
      entity_id: payload.entityId ?? null,
      metadata: payload.metadata ?? null,
      created_at: new Date().toISOString(),
    } as never)
  } catch (e) {
    console.warn('[audit] skipped:', e)
  }
}

export function auditFromSession(
  session: AppSession,
  partial: Omit<AuditPayload, 'actorEmail' | 'actorName'>
): AuditPayload {
  return {
    ...partial,
    actorEmail: session.email ?? null,
    actorName: session.name,
  }
}
