import { describe, it, expect } from 'vitest'
import {
  createMockSupabaseResponse,
  createMockOrder,
  createMockCustomer,
  createMockDriver,
  createMockStaff,
  createMockInventory,
  createMockStripeEvent,
} from './mocks'

describe('Test Mock Helpers', () => {
  describe('createMockSupabaseResponse', () => {
    it('creates response with data and no error', () => {
      const response = createMockSupabaseResponse({ id: 'test' })
      expect(response.data).toEqual({ id: 'test' })
      expect(response.error).toBeNull()
    })

    it('creates response with error', () => {
      const err = new Error('Test error')
      const response = createMockSupabaseResponse(null, err)
      expect(response.data).toBeNull()
      expect(response.error).toBe(err)
    })

    it('creates null response', () => {
      const response = createMockSupabaseResponse(null)
      expect(response.data).toBeNull()
      expect(response.error).toBeNull()
    })
  })

  describe('createMockOrder', () => {
    it('creates order with default values', () => {
      const order = createMockOrder()
      expect(order.id).toBe('test-order-id')
      expect(order.customer_name).toBe('Test Customer Ltd')
      expect(order.status).toBe('Booked')
      expect(order.paid).toBe(false)
    })

    it('overrides default values', () => {
      const order = createMockOrder({ status: 'Completed', skip_size: '12' })
      expect(order.status).toBe('Completed')
      expect(order.skip_size).toBe('12')
      expect(order.customer_name).toBe('Test Customer Ltd') // unchanged
    })

    it('allows adding extra fields', () => {
      const order = createMockOrder({ driver_id: 'drv-123', notes: 'Extra info' })
      expect(order.driver_id).toBe('drv-123')
      expect(order.notes).toBe('Extra info')
    })
  })

  describe('createMockCustomer', () => {
    it('creates customer with default values', () => {
      const customer = createMockCustomer()
      expect(customer.id).toBe('test-customer-id')
      expect(customer.name).toBe('Test Customer Ltd')
      expect(customer.account_balance).toBe(0)
    })

    it('overrides specific fields', () => {
      const customer = createMockCustomer({ account_balance: 250.50, phone: '07987654321' })
      expect(customer.account_balance).toBe(250.50)
      expect(customer.phone).toBe('07987654321')
    })
  })

  describe('createMockDriver', () => {
    it('creates driver with default values', () => {
      const driver = createMockDriver()
      expect(driver.id).toBe('test-driver-id')
      expect(driver.name).toBe('Test Driver')
      expect(driver.pin).toBe('1234')
      expect(driver.status).toBe('Available')
    })

    it('overrides specific fields', () => {
      const driver = createMockDriver({ status: 'On Job', pay_rate: 18.00 })
      expect(driver.status).toBe('On Job')
      expect(driver.pay_rate).toBe(18.00)
    })
  })

  describe('createMockStaff', () => {
    it('creates staff with default values', () => {
      const staff = createMockStaff()
      expect(staff.id).toBe('test-staff-id')
      expect(staff.name).toBe('Test Staff')
      expect(staff.role).toBe('office')
    })
  })

  describe('createMockInventory', () => {
    it('creates inventory with default values', () => {
      const inv = createMockInventory()
      expect(inv.id).toBe('test-inv-id')
      expect(inv.skip_id).toBe('SKP-001')
      expect(inv.status).toBe('In Yard')
    })

    it('creates inventory in use', () => {
      const inv = createMockInventory({
        status: 'In Use',
        customer_name: 'Active Customer',
        delivery_address: '123 Site Rd',
      })
      expect(inv.status).toBe('In Use')
      expect(inv.customer_name).toBe('Active Customer')
    })
  })

  describe('createMockStripeEvent', () => {
    it('creates checkout.session.completed by default', () => {
      const event = createMockStripeEvent()
      expect(event.id).toBe('evt_test_123')
      expect(event.type).toBe('checkout.session.completed')
    })

    it('allows custom event types', () => {
      const event = createMockStripeEvent('invoice.payment_failed')
      expect(event.type).toBe('invoice.payment_failed')
    })

    it('includes session object in data', () => {
      const event = createMockStripeEvent()
      const obj = (event.data as Record<string, unknown>).object as Record<string, unknown>
      expect(obj.id).toBe('cs_test_123')
      expect(obj.amount_total).toBe(50000)
    })
  })
})
