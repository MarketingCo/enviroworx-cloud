import Link from 'next/link'
import { Monitor, Truck, Users, Scale, Phone } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase'
import { DEFAULT_CONFIG } from '@/lib/config'

export const revalidate = 300

// Pre-auth entry page: no session yet, so this shows the default tenant's
// branding until /t/[slug] tenant context lands (P5.3).
const DEFAULT_TENANT_ID = '56ec5b3f-6d42-4672-a98c-d60d9c22f284'

async function getBranding() {
  const { data } = await supabaseAdmin
    .from('config')
    .select('key, value')
    .eq('tenant_id', DEFAULT_TENANT_ID)
    .in('key', ['company_name', 'office_phone'])
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value as string]))
  return {
    companyName: map.company_name || DEFAULT_CONFIG.companyName,
    officePhone: map.office_phone || DEFAULT_CONFIG.officePhone,
  }
}

const ENTRIES = [
  { href: '/office', label: 'Office', desc: 'Dispatch, bookings, reports', icon: Monitor },
  { href: '/driver', label: 'Driver', desc: 'Jobs, navigation, proof of service', icon: Truck },
  { href: '/portal', label: 'Customer portal', desc: 'Your hires, invoices and requests', icon: Users },
  { href: '/tablet', label: 'Yard tablet', desc: 'Weighbridge and yard operations', icon: Scale },
]

export default async function Home() {
  const { companyName, officePhone } = await getBranding()

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-6 py-16">
      <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-center">
        {companyName}
      </h1>
      <p className="text-sm text-slate-400 mt-2 mb-10 text-center">Waste operations system — choose where you&apos;re going</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {ENTRIES.map(({ href, label, desc, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group bg-slate-900 border border-white/5 hover:border-primary/50 rounded-2xl p-6 flex items-center gap-4 transition-colors"
          >
            <Icon size={28} className="text-primary shrink-0" />
            <div>
              <p className="font-black uppercase tracking-widest text-sm group-hover:text-primary transition-colors">
                {label}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <a
        href={`tel:${officePhone}`}
        className="mt-10 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <Phone size={14} /> {officePhone}
      </a>
    </main>
  )
}
