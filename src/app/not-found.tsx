import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center space-y-6">
        <h1 className="text-8xl font-black text-emerald-500">404</h1>
        <p className="text-xl text-slate-400">Page not found</p>
        <Link
          href="/"
          className="inline-block bg-emerald-500 text-white px-8 py-3 rounded font-bold text-sm hover:bg-emerald-600 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}
