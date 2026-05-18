import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import Stripe from 'stripe'
import { supabaseAdmin, safeActivityLog } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
  safeActivityLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: vi.fn((_body: string, _sig: string, _secret: string) => ({
        id: 'evt_test_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            metadata: { customer_id: 'cust-123', customer_name: 'Test Customer', order_ids: '["order-1", "order-2"]' },
            amount_total: 50000,
          },
        },
      })),
    },
  })),
}))

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_123')
  })

  function createMockRequest(body: Record<string, unknown>, signature?: string): any {
    return {
      headers: {
        get: (name: string) => name === 'stripe-signature' ? signature : null,
      },
      text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    }
  }

  it('returns 400 when stripe-signature header is missing', async () => {
    const req = createMockRequest({})
    const response = await POST(req)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Missing stripe-signature')
  })

  it('processes checkout.session.completed and marks orders as paid', async () => {
    const mockSession = {
      id: 'cs_test_123',
      metadata: { customer_id: 'cust-123', customer_name: 'Test Customer', order_ids: '["order-1", "order-2"]' },
      amount_total: 50000,
    }

    // Mock no duplicate event
    const mockFromChain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(mockFromChain as any)

    const req = createMockRequest(mockSession, 'sig_test_123')
    const response = await POST(req)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.received).toBe(true)
  })

  it('skips duplicate events', async () => {
    const mockSession = {
      id: 'cs_test_123',
      metadata: { customer_id: 'cust-123', order_ids: '["order-1"]' },
      amount_total: 50000,
    }

    // Mock existing event found
    const mockFromChain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'evt_test_123' }, error: null }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(mockFromChain as any)

    const req = createMockRequest(mockSession, 'sig_test_123')
    const response = await POST(req)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.received).toBe(true)
    expect(body.duplicate).toBe(true)
  })

  it('handles webhook verification failure', async () => {
    const { default: Stripe } = await import('stripe')
    vi.mocked(Stripe).mockImplementation(() => ({
      webhooks: {
        constructEvent: vi.fn(() => {
          throw new Error('Invalid signature')
        }),
      },
    }) as any)

    const req = createMockRequest({ id: 'evt_bad' }, 'bad_sig')
    const response = await POST(req)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Webhook error')
  })

  it('logs payment activity', async () => {
    const mockSession = {
      id: 'cs_test_123',
      metadata: { customer_id: 'cust-123', customer_name: 'Test Customer', order_ids: '["order-1"]' },
      amount_total: 50000,
    }

    const mockFromChain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(mockFromChain as any)

    const req = createMockRequest(mockSession, 'sig_test_123')
    await POST(req)

    expect(safeActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SYS',
        message: expect.stringContaining('Online payment received'),
        status: 'Completed',
      })
    )
  })

  it('processes customer_id fallback when no order_ids in metadata', async () => {
    const mockSession = {
      id: 'cs_test_456',
      metadata: { customer_id: 'cust-456', customer_name: 'Fallback Customer' },
      amount_total: 25000,
    }

    const mockFromChain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(mockFromChain as any)

    const req = createMockRequest(mockSession, 'sig_test_456')
    const response = await POST(req)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.received).toBe(true)
  })

  it('handles unhandled event types gracefully', async () => {
    const { default: Stripe } = await import('stripe')
    vi.mocked(Stripe).mockImplementation(() => ({
      webhooks: {
        constructEvent: vi.fn(() => ({
          id: 'evt_other_456',
          type: 'invoice.payment_failed',
          data: { object: {} },
        })),
      },
    }) as any)

    const mockFromChain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(mockFromChain as any)

    const req = createMockRequest({ type: 'invoice.payment_failed' }, 'sig_test')
    const response = await POST(req)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.received).toBe(true)
  })
})
