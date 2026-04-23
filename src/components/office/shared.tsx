import { DEFAULT_CONFIG, SKIP_SIZES, WB_SIZES } from '@/lib/config'

export type Tab = 'dashboard' | 'dispatch' | 'weighbridge' | 'bookings' | 'customers' | 'reports' | 'inventory' | 'fleet' | 'map' | 'settings'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DashStats {
  stats: {
    completedToday: number
    completedWeek: number
    futureBookings: number
    tipsToday: number
    estProfitToday: number
  }
  inventorySummary: any[]
  activeTippers: any[]
  unpaidInvoices: any[]
  driverHours: any[]
  collections: any[]
  expiringPermits: any[]
}

export function fmt(n: number) { return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
export function today() { return new Date().toISOString().split('T')[0] }
export function tomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export function KpiCard({ label, value, icon, color = 'text-primary' }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center ${color}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-lg font-black text-white">{value}</p>
      </div>
    </div>
  )
}

export function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">{title}</h3>
}

export function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${color}`}>{label}</span>
}

export function statusColor(status: string) {
  const colors: Record<string, string> = {
    'Booked': 'bg-blue-500/10 text-blue-400',
    'Assigned': 'bg-indigo-500/10 text-indigo-400',
    'Out for Delivery': 'bg-amber-500/10 text-amber-400',
    'Completed': 'bg-emerald-500/10 text-emerald-400',
    'Cancelled': 'bg-red-500/10 text-red-400',
    'Aborted': 'bg-red-500/10 text-red-400',
    'Available': 'bg-emerald-500/10 text-emerald-400',
    'In Use': 'bg-amber-500/10 text-amber-400',
    'Delivered': 'bg-blue-500/10 text-blue-400',
    'Damaged': 'bg-red-500/10 text-red-400',
    'Off Road': 'bg-slate-500/10 text-slate-400',
    'Maintenance': 'bg-orange-500/10 text-orange-400',
  }
  return colors[status] || 'bg-slate-500/10 text-slate-400'
}

export { DEFAULT_CONFIG, SKIP_SIZES, WB_SIZES }
