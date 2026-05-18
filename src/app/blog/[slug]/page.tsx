import { blogPosts } from "@/lib/blog-data";
import { notFound } from "next/navigation";
import { Clock, ArrowLeft, Zap } from "lucide-react";
import Link from "next/link";
import ShareButton from "./ShareButton";

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const post = blogPosts.find((p) => p.slug === params.slug);
  if (!post) return {};
  return {
    title: `${post.title} | Enviroworx Cloud`,
    description: post.excerpt,
    keywords: post.keywords.join(", "),
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    notFound();
  }

  const related = blogPosts
    .filter((p) => p.slug !== slug && p.category === post.category)
    .slice(0, 2);

  const contentHtml = post.content
    .trim()
    .split("\n\n")
    .map((para) => {
      if (para.startsWith("## ")) {
        return `<h2 class="text-3xl font-black uppercase tracking-tighter italic text-white mt-16 mb-8">${para.replace("## ", "")}</h2>`;
      }
      if (para.startsWith("### ")) {
        return `<h3 class="text-xl font-black uppercase tracking-tighter italic text-brand-green mt-12 mb-6">${para.replace("### ", "")}</h3>`;
      }
      if (para.startsWith("- ")) {
        const items = para
          .split("\n")
          .map((line) => `<li class="text-slate-300 leading-loose">${line.replace("- ", "")}</li>`)
          .join("");
        return `<ul class="list-disc list-inside space-y-2 my-6">${items}</ul>`;
      }
      if (/^\d+\./.test(para)) {
        const items = para
          .split("\n")
          .map((line) => `<li class="text-slate-300 leading-loose">${line.replace(/^\d+\.\s*/, "")}</li>`)
          .join("");
        return `<ol class="list-decimal list-inside space-y-2 my-6">${items}</ol>`;
      }
      return `<p class="text-xl text-slate-300 leading-loose font-light">${para}</p>`;
    })
    .join("");

  return (
    <div className="bg-slate-950 text-white min-h-screen">
      <div className="h-24 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl"></div>

      <article className="relative z-10 py-32 px-6">
        <div className="max-w-3xl mx-auto space-y-16">
          <div className="flex items-center justify-between">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 hover:text-brand-green transition-colors group"
            >
              <ArrowLeft
                size={12}
                className="group-hover:-translate-x-1 transition-transform text-brand-green"
              />{" "}
              Back to Journal
            </Link>
            <ShareButton title={post.title} url={`https://enviroworx.cloud/blog/${post.slug}`} />
          </div>

          <div className="space-y-8">
            <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
              <span className="flex items-center gap-2">
                <Clock size={12} className="text-brand-green" /> {post.date}
              </span>
              <span className="bg-white/5 px-3 py-1 rounded text-white">
                {post.category}
              </span>
              <span>{post.readTime}</span>
            </div>
            <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter italic leading-none text-white">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 pt-4">
              <div className="w-12 h-12 rounded-full bg-brand-green/20 flex items-center justify-center text-brand-green font-black text-lg">
                {post.author.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-bold text-white">{post.author}</p>
                <p className="text-xs text-slate-500">{post.authorRole}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden">
            <img
              src={post.image}
              alt={post.title}
              className="w-full h-96 object-cover"
            />
          </div>

          <div
            className="space-y-8"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          {related.length > 0 && (
            <div className="pt-16 border-t border-white/5">
              <h3 className="text-2xl font-black uppercase tracking-tighter italic mb-8">
                Related Articles
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="group block bg-slate-900 border border-white/5 p-8 hover:border-brand-green/50 transition-all"
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-green">
                      {r.category}
                    </span>
                    <h4 className="text-xl font-black uppercase tracking-tighter italic mt-4 group-hover:text-brand-green transition-colors">
                      {r.title}
                    </h4>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="pt-20 border-t border-white/5">
            <div className="bg-slate-900 p-16 space-y-10 text-center rounded-[40px] border border-white/5">
              <h3 className="text-4xl font-black uppercase tracking-tighter italic">
                Modernise Your Operations.
              </h3>
              <p className="text-slate-400 max-w-lg mx-auto italic">
                Book a systems audit today and see the future of waste
                logistics and environmental compliance in action.
              </p>
              <div className="flex justify-center">
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-6 bg-white text-slate-950 px-16 py-6 rounded font-black uppercase text-xs tracking-[0.4em] hover:bg-brand-green transition-all shadow-3xl"
                >
                  Schedule Demo <Zap size={20} fill="currentColor" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
