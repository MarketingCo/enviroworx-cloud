import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

/**
 * Tenant-isolation tripwire (P5.1).
 *
 * Static check: every `.from('<tenant table>')` chain in the server data
 * layer must mention tenant_id / tenantId within the same chain. Crude and
 * regex-based, but it catches the most likely regression — someone adding
 * a query without the tenant filter.
 */

// Tables with a tenant_id column (from the live schema). activity_log is
// excluded: the audit layer is shared and writes are tenant-agnostic by design.
const TENANT_TABLES = [
  'active_tippers',
  'archive_orders',
  'carrier_licences',
  'cash_log',
  'config',
  'custom_pricing',
  'customers',
  'driver_hours',
  'drivers',
  'external_map_points',
  'fleet_logs',
  'fuel_cards',
  'hr_logs',
  'incidents',
  'inventory',
  'lorries',
  'maintenance_logs',
  'office_staff',
  'orders',
  'permits',
  'route_performance_logs',
  'route_plans',
  'shifts',
  'skip_combos',
  'skips',
  'tare_weights',
  'vehicle_checks',
  'vehicle_maintenance',
  'vehicle_telemetry',
  'vehicles',
  'walkaround_checks',
  'waste_transfer_notes',
  'weighbridge_readings',
  'weight_logs',
  'yard_staff',
]

// Known-safe exceptions: "<file>:<table>" — each must have a comment here
// explaining why the query is safe without tenant_id in the same chain.
const ALLOWED_UNSCOPED: string[] = [
  // archiveOldOrders inserts archiveRows built with tenant_id two
  // statements above the .insert() chain.
  'lib/api-server.ts:archive_orders',
]

const ROOT = join(__dirname, '..', '..')

function sourceFiles(): { name: string; content: string }[] {
  const files: { name: string; content: string }[] = []
  const actionsDir = join(ROOT, 'app', 'actions')
  for (const f of readdirSync(actionsDir)) {
    if (f.endsWith('.ts')) files.push({ name: `actions/${f}`, content: readFileSync(join(actionsDir, f), 'utf8') })
  }
  files.push({ name: 'lib/api-server.ts', content: readFileSync(join(ROOT, 'lib', 'api-server.ts'), 'utf8') })
  return files
}

/** The chain window: from `.from(` to the next blank line (end of the
 *  statement in this codebase's formatting) or 1200 chars, whichever first. */
function chainWindow(content: string, fromIndex: number): string {
  const rest = content.slice(fromIndex, fromIndex + 1200)
  const blank = rest.indexOf('\n\n')
  return blank === -1 ? rest : rest.slice(0, blank)
}

describe('tenant isolation', () => {
  const files = sourceFiles()

  it('found the server data layer', () => {
    expect(files.length).toBeGreaterThan(3)
  })

  for (const table of TENANT_TABLES) {
    it(`every query on "${table}" is tenant-scoped`, () => {
      const offenders: string[] = []
      for (const { name, content } of files) {
        const re = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)`, 'g')
        let m: RegExpExecArray | null
        while ((m = re.exec(content)) !== null) {
          const chain = chainWindow(content, m.index)
          if (!/tenant_id|tenantId/.test(chain) && !ALLOWED_UNSCOPED.includes(`${name}:${table}`)) {
            const line = content.slice(0, m.index).split('\n').length
            offenders.push(`${name}:${line}`)
          }
        }
      }
      expect(offenders, `unscoped queries on ${table}: ${offenders.join(', ')}`).toEqual([])
    })
  }
})
