"use client";

import { Share2 } from "lucide-react";

export default function ShareButton({
  title,
  url,
}: {
  title: string;
  url: string;
}) {
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard");
    }
  };
  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 hover:text-brand-green transition-colors"
    >
      <Share2 size={14} /> Share
    </button>
  );
}
