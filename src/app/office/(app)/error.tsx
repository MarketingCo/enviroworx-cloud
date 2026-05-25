'use client'

import { useEffect } from 'react'

export default function OfficeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[office]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">Something went wrong</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          The office app hit an error. Try again, or sign out and back in. If it keeps happening, check Vercel
          logs and Supabase status.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="bg-primary text-white px-6 py-3 rounded-lg font-black uppercase tracking-widest text-xs"
          >
            Try again
          </button>
          <a
            href="/office/login"
            className="bg-slate-800 text-slate-300 px-6 py-3 rounded-lg font-black uppercase tracking-widest text-xs border border-white/10"
          >
            Sign in again
          </a>
        </div>
      </div>
    </div>
  )
}
