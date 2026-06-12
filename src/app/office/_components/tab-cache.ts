/**
 * Session-lived cache so office tabs render their last data instantly on
 * revisit and refresh in the background, instead of blanking to a spinner
 * on every switch. Module-level: survives tab switches, not reloads.
 */
const cache = new Map<string, unknown>()

export function getTabCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined
}

export function setTabCache(key: string, value: unknown) {
  cache.set(key, value)
}
