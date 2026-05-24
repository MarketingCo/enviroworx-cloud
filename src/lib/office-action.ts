import { requireOfficeSession, type AppSession } from '@/lib/session'
import { auditFromSession, writeAudit } from '@/lib/audit'
import { toActionError } from '@/lib/action-errors'

type OfficeActionOpts = {
  type: string
  message: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
}

export async function withOfficeAction<T>(
  opts: OfficeActionOpts,
  fn: (session: AppSession) => Promise<T>
): Promise<T> {
  const session = await requireOfficeSession()
  try {
    const result = await fn(session)
    await writeAudit(
      auditFromSession(session, {
        type: opts.type,
        message: opts.message,
        status: 'ok',
        entityType: opts.entityType ?? null,
        entityId: opts.entityId ?? null,
        metadata: opts.metadata ?? null,
      })
    )
    return result
  } catch (error) {
    await writeAudit(
      auditFromSession(session, {
        type: opts.type,
        message: opts.message,
        status: 'error',
        entityType: opts.entityType ?? null,
        entityId: opts.entityId ?? null,
        metadata: {
          ...(opts.metadata ?? {}),
          error: error instanceof Error ? error.message : 'unknown',
        },
      })
    )
    throw toActionError(error)
  }
}
