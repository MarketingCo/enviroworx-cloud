import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendSms } from './sms'

// Mock twilio module
vi.mock('twilio', () => ({
  default: vi.fn((sid: string, token: string) => ({
    messages: {
      create: vi.fn().mockResolvedValue({ sid: 'SM_test_123' }),
    },
  })),
}))

describe('sendSms', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      TWILIO_ACCOUNT_SID: 'test_sid',
      TWILIO_AUTH_TOKEN: 'test_token',
      TWILIO_FROM_NUMBER: '+441234567890',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns success when credentials are configured', async () => {
    const result = await sendSms('07123456789', 'Test message')
    expect(result.success).toBe(true)
    expect(result.sid).toBe('SM_test_123')
  })

  it('formats UK number without leading +', async () => {
    const { default: twilio } = await import('twilio')
    await sendSms('07123456789', 'Hello')
    expect(twilio).toHaveBeenCalledWith('test_sid', 'test_token')
  })

  it('passes through number already starting with +', async () => {
    const twilioModule = await import('twilio')
    const result = await sendSms('+447123456789', 'Hello')
    expect(result.success).toBe(true)
  })

  it('returns error when credentials are missing', async () => {
    delete process.env.TWILIO_ACCOUNT_SID
    const result = await sendSms('07123456789', 'Test')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Credentials missing')
  })

  it('returns error when auth token is missing', async () => {
    delete process.env.TWILIO_AUTH_TOKEN
    const result = await sendSms('07123456789', 'Test')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Credentials missing')
  })

  it('returns error when from number is missing', async () => {
    delete process.env.TWILIO_FROM_NUMBER
    const result = await sendSms('07123456789', 'Test')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Credentials missing')
  })

  it('handles Twilio API errors', async () => {
    const { default: twilio } = await import('twilio')
    vi.mocked(twilio).mockImplementation(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('Invalid phone number')),
      },
    }))

    const result = await sendSms('invalid', 'Test')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid phone number')
  })

  it('handles non-Error exceptions', async () => {
    const { default: twilio } = await import('twilio')
    vi.mocked(twilio).mockImplementation(() => ({
      messages: {
        create: vi.fn().mockRejectedValue('string error'),
      },
    }))

    const result = await sendSms('07123456789', 'Test')
    expect(result.success).toBe(false)
    expect(result.error).toBe('string error')
  })
})
