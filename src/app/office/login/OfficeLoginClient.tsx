'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

const ERROR_COPY: Record<string, string> = {
  forbidden: 'Your Google account is not allowed to use the office app. Ask an admin to add your email or domain.',
  auth: 'Sign-in failed. Try again.',
  config: 'Server is missing Supabase configuration.',
}

type Props = {
  pinAuthEnabled: boolean
  error?: string
  nextPath?: string
}

export default function OfficeLoginClient({ pinAuthEnabled, error, nextPath }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogle() {
    setGoogleLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const next = nextPath?.startsWith('/') ? nextPath : '/office'
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      if (oauthError) {
        toast.error(oauthError.message)
        setGoogleLoading(false)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Google sign-in failed')
      setGoogleLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || pin.length < 4) {
      toast.error('Enter your name and 4-digit PIN')
      return
    }
    setLoading(true)

    const res = await fetch('/api/auth/office', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), pin: pin.trim() }),
    })
    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error || 'Invalid credentials')
      setLoading(false)
      return
    }

    sessionStorage.setItem(
      'office_session',
      JSON.stringify({
        name: data.user.name,
        id: data.user.id,
        role: data.user.role,
        loginAt: Date.now(),
      })
    )

    router.push('/office')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />

      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center font-black italic text-xl text-white mx-auto mb-4">
            E
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Enviroworx</h1>
          <p className="text-slate-500 text-sm mt-1 font-bold uppercase tracking-widest">Office System</p>
        </div>

        {error && ERROR_COPY[error] ? (
          <p
            role="alert"
            className="mb-6 text-sm text-amber-400/95 text-center leading-relaxed rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3"
          >
            {ERROR_COPY[error]}
          </p>
        ) : null}

        <div className="bg-slate-900 border border-white/5 rounded-2xl p-8 space-y-5">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 py-3 rounded-lg font-black uppercase tracking-widest text-sm transition-all hover:bg-slate-100 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {pinAuthEnabled ? (
            <>
              <div className="flex items-center gap-3 text-slate-600">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] font-black uppercase tracking-widest">or PIN</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 block mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoFocus
                    className="w-full bg-slate-800 border border-white/10 text-white px-4 py-3 rounded-lg text-sm focus:border-primary focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 block mb-2">
                    PIN
                  </label>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="4-digit PIN"
                    inputMode="numeric"
                    maxLength={4}
                    className="w-full bg-slate-800 border border-white/10 text-white px-4 py-3 rounded-lg text-sm focus:border-primary focus:outline-none transition-colors tracking-[0.5em] text-center text-xl"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-black uppercase tracking-widest text-sm transition-all disabled:opacity-50"
                >
                  {loading ? 'Signing in…' : 'Sign in with PIN'}
                </button>
              </form>
            </>
          ) : (
            <p className="text-center text-xs text-slate-500 leading-relaxed">
              Use your company Google account. PIN sign-in is disabled unless{' '}
              <code className="text-slate-400">OFFICE_PIN_AUTH_ENABLED=true</code>.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-center gap-4">
          <a
            href="/driver"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-bold uppercase tracking-widest"
          >
            Driver App
          </a>
          <span className="text-slate-700">·</span>
          <a
            href="/portal"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-bold uppercase tracking-widest"
          >
            Customer Portal
          </a>
        </div>
      </div>
    </div>
  )
}
