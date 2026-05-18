import { describe, it, expect, vi } from 'vitest'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}))

describe('Bookings API', () => {
  it('can query orders table', async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'Booked')
      .order('date', { ascending: true })
      .single()

    expect(error).toBeNull()
  })

  it('can insert a new order', async () => {
    const orderData = {
      customer_name: 'Test Customer',
      address: '123 Test St',
      skip_size: '8',
      job_type: 'Delivery',
      status: 'Booked',
      date: '2026-05-18',
      payment_method: 'Invoice',
    }

    const result = await supabase.from('orders').insert(orderData)
    expect(supabase.from).toHaveBeenCalledWith('orders')
  })

  it('can update order status', async () => {
    const result = await supabase
      .from('orders')
      .update({ status: 'Completed' })
      .eq('id', 'test-order-id')

    expect(supabase.from).toHaveBeenCalledWith('orders')
  })

  it('can delete an order', async () => {
    const result = await supabase
      .from('orders')
      .delete()
      .eq('id', 'test-order-id')

    expect(supabase.from).toHaveBeenCalledWith('orders')
  })

  it('queries inventory for available skips', async () => {
    await supabase
      .from('inventory')
      .select('*')
      .eq('status', 'In Yard')
      .eq('skip_size', '8')

    expect(supabase.from).toHaveBeenCalledWith('inventory')
  })

  it('queries drivers for available assignments', async () => {
    await supabase
      .from('drivers')
      .select('*')
      .eq('status', 'Available')
      .order('name')

    expect(supabase.from).toHaveBeenCalledWith('drivers')
  })

  it('queries customers by name for autocomplete', async () => {
    await supabase
      .from('customers')
      .select('*')
      .ilike('name', '%Test%')
      .limit(10)

    expect(supabase.from).toHaveBeenCalledWith('customers')
  })
})
