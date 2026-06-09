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

const BUTTON_VARIANTS = {
  primary: 'bg-primary text-slate-900 hover:opacity-90',
  secondary: 'bg-slate-800 text-white border border-white/10 hover:bg-slate-700',
  danger: 'bg-red-600 text-white hover:bg-red-500',
  ghost: 'bg-transparent text-slate-400 hover:text-white hover:bg-white/5',
} as const

export function Button({
  variant = 'primary',
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: {
  variant?: keyof typeof BUTTON_VARIANTS
  loading?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled || loading}
      className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  )
}

export function EmptyState({
  icon,
  message,
  action,
}: {
  icon?: ReactNode
  message: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      {icon && <div className="text-slate-600">{icon}</div>}
      <p className="text-sm text-slate-400">{message}</p>
      {action}
    </div>
  )
}

export function TableShell({
  headers,
  children,
}: {
  headers: string[]
  children: ReactNode
}) {
  return (
    <div className="bg-slate-900 border border-white/5 rounded-xl overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/5">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-xs text-slate-300">{children}</tbody>
      </table>
    </div>
  )
}

export function LoadingSkeleton({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-slate-800/40 rounded-xl animate-pulse" />
      ))}
    </div>
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
