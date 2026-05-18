import { blogPosts } from "@/lib/blog-data";
import Link from "next/link";
import { ArrowRight, Clock, MonitorDot } from "lucide-react";

export const metadata = {
  title: "Journal | Enviroworx Cloud",
  description:
    "Operational insights on waste logistics, environmental remediation, asbestos removal, and hazardous waste management across Scotland.",
};

export default function BlogPage() {
  const featured = blogPosts[0];
  const posts = blogPosts.slice(1);

  return (
    <div className="bg-slate-950 text-white min-h-screen">
      <div className="h-24 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl"></div>

      <section className="relative z-10 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-24 space-y-8">
            <div className="inline-flex items-center gap-3 bg-brand-green/10 border border-brand-green/20 px-4 py-1 rounded-full text-brand-green font-black uppercase text-[10px] tracking-[0.4em]">
              <MonitorDot size={14} /> The Cloud Journal
            </div>
            <h1 className="text-7xl md:text-9xl font-black uppercase tracking-tighter italic leading-none">
              Operational <span className="text-brand-green">Insights</span>
            </h1>
            <p className="text-2xl text-slate-500 font-light max-w-2xl leading-relaxed italic border-l border-brand-green/30 pl-8">
              Deep dives into waste logistics, environmental remediation, asbestos
              removal, and sustainable infrastructure across Scotland.
            </p>
          </div>

          {/* Featured Post */}
          <Link
            href={`/blog/${featured.slug}`}
            className="group block mb-16"
          >
            <div className="relative h-[500px] rounded-2xl overflow-hidden">
              <img
                src={featured.image}
                alt={featured.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-12">
                <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 mb-6">
                  <span className="flex items-center gap-2">
                    <Clock size={12} className="text-brand-green" />{" "}
                    {featured.date}
                  </span>
                  <span className="bg-brand-green/20 text-brand-green px-3 py-1 rounded">
                    {featured.category}
                  </span>
                </div>
                <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic leading-tight group-hover:text-brand-green transition-colors max-w-3xl">
                  {featured.title}
                </h2>
                <p className="text-xl text-slate-300 font-light leading-relaxed mt-4 max-w-2xl">
                  {featured.excerpt}
                </p>
              </div>
            </div>
          </Link>

          {/* Post Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="group bg-slate-900 border border-white/5 hover:border-brand-green/50 transition-all"
              >
                <Link href={`/blog/${post.slug}`}>
                  <div className="h-64 overflow-hidden">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-12 space-y-10">
                    <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
                      <span className="flex items-center gap-2">
                        <Clock size={12} className="text-brand-green" />{" "}
                        {post.date}
                      </span>
                      <span className="bg-white/5 px-3 py-1 rounded text-white">
                        {post.category}
                      </span>
                    </div>
                    <h2 className="text-4xl font-black uppercase tracking-tighter italic leading-tight group-hover:text-brand-green transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-xl text-slate-400 font-light leading-relaxed">
                      {post.excerpt}
                    </p>
                    <div className="pt-6 flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.4em] text-white group-hover:gap-8 transition-all">
                      Read Article{" "}
                      <ArrowRight size={16} className="text-brand-green" />
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
