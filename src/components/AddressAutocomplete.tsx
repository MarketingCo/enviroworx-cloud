'use client'

import { useEffect, useRef, useState } from 'react'
import {
  resolvePlaceAddressAction,
  searchAddressSuggestionsAction,
  type AddressSuggestion,
} from '@/app/actions/places'

type Props = {
  value: string
  onChange: (address: string) => void
  onResolved?: (result: { address: string; lat: number | null; lng: number | null }) => void
  placeholder?: string
  className?: string
  verified?: boolean
}

export default function AddressAutocomplete({
  value,
  onChange,
  onResolved,
  placeholder = 'Start typing address…',
  className = '',
  verified = false,
}: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function handleInput(v: string) {
    onChange(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (v.length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await searchAddressSuggestionsAction(v)
        setSuggestions(results)
        setOpen(results.length > 0)
      } catch {
        setSuggestions([])
        setOpen(false)
      }
      setLoading(false)
    }, 280)
  }

  async function pick(s: AddressSuggestion) {
    setOpen(false)
    setSuggestions([])
    onChange(s.description)
    setLoading(true)
    try {
      const resolved = await resolvePlaceAddressAction(s.placeId)
      if (resolved) {
        onChange(resolved.address)
        onResolved?.(resolved)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-primary font-bold">
          …
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-slate-800 border border-white/20 rounded-lg shadow-xl max-h-56 overflow-y-auto">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-primary hover:text-slate-900 border-b border-white/5 last:border-0"
              >
                {s.description}
              </button>
            </li>
          ))}
        </ul>
      )}
      {verified && (
        <p className="text-[9px] text-emerald-500 font-bold mt-1 uppercase tracking-tighter">
          ✓ Address verified (Central Belt)
        </p>
      )}
    </div>
  )
}
