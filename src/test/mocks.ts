import { vi } from 'vitest'

/* ------------------------------------------------------------------ */
/*  Supabase response helpers                                          */
/* ------------------------------------------------------------------ */

export function createMockSupabaseResponse<T>(
  data: T | null,
  error: Error | null = null
): { data: T | null; error: Error | null } {
  return { data, error }
}

/* ------------------------------------------------------------------ */
/*  Entity factory helpers                                             */
/* ------------------------------------------------------------------ */

export function createMockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-order-id',
    customer_name: 'Test Customer Ltd',
    customer_id: 'test-customer-id',
    address: '123 Test St',
    skip_size: '8',
    job_type: 'Delivery',
    status: 'Booked',
    date: '2026-05-18',
    payment_method: 'Invoice',
    paid: false,
    phone: '01310000000',
    ...overrides,
  }
}

export function createMockCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-customer-id',
    name: 'Test Customer Ltd',
    phone: '01310000000',
    email: 'test@example.com',
    billing_address: '123 Test St',
    shipping_address: '123 Test St',
    account_balance: 0,
    portal_pin: null,
    pin_hash: null,
    auth_user_id: null,
    full_name: 'Test Customer Ltd',
    ...overrides,
  }
}

export function createMockDriver(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-driver-id',
    name: 'Test Driver',
    pin: '1234',
    pin_hash: null,
    status: 'Available',
    pay_rate: 15.50,
    auth_user_id: null,
    ...overrides,
  }
}

export function createMockStaff(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-staff-id',
    name: 'Test Staff',
    role: 'office',
    pin: '5678',
    auth_user_id: 'test-auth-id',
    ...overrides,
  }
}

export function createMockInventory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-inv-id',
    skip_id: 'SKP-001',
    skip_size: '8',
    status: 'In Yard',
    waste_type: 'Mix Con',
    customer_name: null,
    delivery_address: null,
    delivery_date: null,
    collection_date: null,
    ...overrides,
  }
}

export function createMockStripeEvent(
  type: string = 'checkout.session.completed',
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'evt_test_123',
    type,
    data: {
      object: {
        id: 'cs_test_123',
        metadata: { customer_id: 'cust-123', order_ids: '["order-1", "order-2"]' },
        amount_total: 50000,
        customer_name: 'Test Customer',
        ...overrides,
      },
    },
  }
}

/* ------------------------------------------------------------------ */
/*  Mock builder for supabaseAdmin.from() chain                        */
/* ------------------------------------------------------------------ */

export function createMockSupabaseChain(response: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(response),
    // For head:true count queries
    then: vi.fn().mockResolvedValue(response),
  }
  return chain
}
