'use client'

import type { ReactNode } from 'react'

export type Tab =
  | 'dashboard'
  | 'dispatch'
  | 'weighbridge'
  | 'bookings'
  | 'customers'
  | 'reports'
  | 'fleet'
  | 'inventory'
  | 'map'
  | 'activity'
  | 'settings'

export interface DashStats {
  stats: {
    completedToday: number
    completedWeek: number
    futureBookings: number
    tipsToday: number
    estProfitToday: number
  }
  inventorySummary: unknown[]
  activeTippers: unknown[]
  unpaidInvoices: unknown[]
  driverHours: unknown[]
  collections: unknown[]
  expiringPermits: unknown[]
}

export function fmt(n: number) {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function today() {
  return new Date().toISOString().split('T')[0]
}

export function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export function KpiCard({
  label,
  value,
  icon,
  color = 'text-primary',
}: {
  label: string
  value: string | number
  icon: ReactNode
  color?: string
}) {
  return (
    <div className="bg-slate-900 border border-white/5 rounded-xl p-5 flex items-center gap-4">
      <div className={`${color} shrink-0`}>{icon}</div>
      <div>
        <p className="text-2xl font-black tracking-tight text-white">{value}</p>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</p>
      </div>
    </div>
  )
}

export function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">{title}</h3>
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${color}`}>
      {label}
    </span>
  )
}

export function statusColor(status: string) {
  switch (status) {
    case 'Completed':
      return 'bg-green-900/40 text-green-400'
    case 'Assigned':
      return 'bg-blue-900/40 text-blue-400'
    case 'Booked':
      return 'bg-yellow-900/40 text-yellow-400'
    case 'Aborted':
      return 'bg-red-900/40 text-red-400'
    default:
      return 'bg-slate-700 text-slate-400'
  }
}
