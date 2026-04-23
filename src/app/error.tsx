'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center space-y-4">
        <div className="text-6xl">⚠️</div>
        <h1 className="text-xl font-bold text-white">Something went wrong</h1>
        <p className="text-slate-400 text-sm max-w-md">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={reset}
          className="bg-emerald-500 text-white px-6 py-2 rounded font-medium text-sm hover:bg-emerald-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
