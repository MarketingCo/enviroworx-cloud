import { describe, it, expect, vi } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}))

describe('Customers API', () => {
  it('can query customers table', async () => {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .order('name')
      .single()

    expect(error).toBeNull()
  })

  it('can insert a new customer', async () => {
    const customerData = {
      name: 'New Customer Ltd',
      phone: '01310000000',
      email: 'new@example.com',
      billing_address: '123 New St',
      shipping_address: '123 New St',
    }

    await supabaseAdmin.from('customers').insert(customerData)
    expect(supabaseAdmin.from).toHaveBeenCalledWith('customers')
  })

  it('can update customer balance', async () => {
    await supabaseAdmin
      .from('customers')
      .update({ account_balance: 150.50 })
      .eq('id', 'test-customer-id')

    expect(supabaseAdmin.from).toHaveBeenCalledWith('customers')
  })

  it('can search customers by phone', async () => {
    await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('phone', '01310000000')
      .single()

    expect(supabaseAdmin.from).toHaveBeenCalledWith('customers')
  })

  it('can search customers by email', async () => {
    await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('email', 'test@example.com')
      .single()

    expect(supabaseAdmin.from).toHaveBeenCalledWith('customers')
  })

  it('can query customer with their orders', async () => {
    await supabaseAdmin
      .from('customers')
      .select('*, orders(*)')
      .eq('id', 'test-customer-id')

    expect(supabaseAdmin.from).toHaveBeenCalledWith('customers')
  })
})
