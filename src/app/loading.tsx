export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center font-black italic tracking-tighter text-sm text-white animate-pulse">
          E
        </div>
        <p className="text-slate-500 text-sm font-medium">Loading...</p>
      </div>
    </div>
  )
}
