import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { hashPin, verifyPin, verifyCronSecret } from './auth'

describe('auth utilities', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv, PIN_SECRET: 'test-pin-secret-for-testing-only' }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllEnvs()
  })

  /* ---------------------------------------------------------------- */
  /*  PIN hashing                                                       */
  /* ---------------------------------------------------------------- */

  describe('hashPin', () => {
    it('returns consistent hash for same PIN', async () => {
      const hash1 = await hashPin('1234')
      const hash2 = await hashPin('1234')
      expect(hash1).toBe(hash2)
    })

    it('returns different hashes for different PINs', async () => {
      const hash1 = await hashPin('1234')
      const hash2 = await hashPin('5678')
      expect(hash1).not.toBe(hash2)
    })

    it('produces a hex string of expected length', async () => {
      const hash = await hashPin('1234')
      // SHA-256 hex = 64 characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('returns different hashes for same PIN with different secrets', async () => {
      const hash1 = await hashPin('1234')

      // Change the secret by stubbing env
      vi.stubEnv('PIN_SECRET', 'different-secret-value-xyz')
      // Need to re-import to pick up new secret — hashPin reads PIN_SECRET at call time
      const { hashPin: hashPin2 } = await import('./auth')
      const hash2 = await hashPin2('1234')

      expect(hash1).not.toBe(hash2)
    })
  })

  /* ---------------------------------------------------------------- */
  /*  PIN verification                                                  */
  /* ---------------------------------------------------------------- */

  describe('verifyPin', () => {
    it('returns true for correct PIN', async () => {
      const hash = await hashPin('1234')
      expect(await verifyPin('1234', hash)).toBe(true)
    })

    it('returns false for incorrect PIN', async () => {
      const hash = await hashPin('1234')
      expect(await verifyPin('9999', hash)).toBe(false)
    })

    it('returns false when hash has wrong length', async () => {
      expect(await verifyPin('1234', 'tooshort')).toBe(false)
    })

    it('returns false for empty PIN against valid hash', async () => {
      const hash = await hashPin('1234')
      expect(await verifyPin('', hash)).toBe(false)
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Cron secret verification                                          */
  /* ---------------------------------------------------------------- */

  describe('verifyCronSecret', () => {
    it('returns true for correct secret', () => {
      const req = new Request('http://test', {
        headers: { authorization: 'Bearer test-secret' },
      })
      vi.stubEnv('CRON_SECRET', 'test-secret')
      expect(verifyCronSecret(req)).toBe(true)
    })

    it('returns false for incorrect secret', () => {
      const req = new Request('http://test', {
        headers: { authorization: 'Bearer wrong-secret' },
      })
      vi.stubEnv('CRON_SECRET', 'test-secret')
      expect(verifyCronSecret(req)).toBe(false)
    })

    it('returns false when no authorization header', () => {
      const req = new Request('http://test')
      vi.stubEnv('CRON_SECRET', 'test-secret')
      expect(verifyCronSecret(req)).toBe(false)
    })

    it('returns false when CRON_SECRET env is not set', () => {
      const req = new Request('http://test', {
        headers: { authorization: 'Bearer test-secret' },
      })
      vi.stubEnv('CRON_SECRET', '')
      expect(verifyCronSecret(req)).toBe(false)
    })

    it('returns false for non-Bearer authorization', () => {
      const req = new Request('http://test', {
        headers: { authorization: 'Basic test-secret' },
      })
      vi.stubEnv('CRON_SECRET', 'test-secret')
      expect(verifyCronSecret(req)).toBe(false)
    })
  })
})
