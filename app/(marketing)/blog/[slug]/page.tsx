import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { mdxComponents } from "@/components/mdx/MDXComponents";
import { JsonLdArticle, JsonLdBreadcrumb } from "@/components/seo/JsonLd";
import {
  getPost,
  getPostSlugs,
  getRelatedPosts,
} from "@/lib/blog";
import { formatDate } from "@/lib/format";

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const post = getPost(params.slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.meta.title,
    description: post.meta.excerpt,
    alternates: { canonical: `/blog/${post.meta.slug}` },
    openGraph: {
      type: "article",
      title: post.meta.title,
      description: post.meta.excerpt,
      images: [{ url: post.meta.hero }],
    },
  };
}

export default function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = getPost(params.slug);
  if (!post) notFound();

  const related = getRelatedPosts(params.slug);
  const { meta } = post;

  return (
    <>
      <JsonLdArticle post={meta} />
      <JsonLdBreadcrumb
        items={[
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: meta.title, url: `/blog/${meta.slug}` },
        ]}
      />

      <article className="py-10">
        <Container className="max-w-prose">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-3">
            <ol className="flex flex-wrap gap-2">
              <li>
                <Link href="/" className="hover:text-brand">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href="/blog" className="hover:text-brand">
                  Blog
                </Link>
              </li>
            </ol>
          </nav>

          <Tag>{meta.category}</Tag>
          <h1 className="mt-3 text-h2">{meta.title}</h1>
          <p className="mt-3 text-sm text-ink-3">
            By {meta.author} · <time dateTime={meta.date}>{formatDate(meta.date)}</time> ·{" "}
            {meta.readTime}
          </p>
        </Container>

        <Container className="my-8 max-w-3xl">
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-surface">
            <Image
              src={meta.hero}
              alt={meta.heroAlt}
              fill
              sizes="(max-width: 768px) 90vw, 768px"
              className="object-contain p-8"
              priority
            />
          </div>
        </Container>

        <Container className="max-w-prose">
          <div className="prose-measure">
            <MDXRemote source={post.content} components={mdxComponents} />
          </div>

          <div className="mt-12 rounded-2xl bg-brand-tint p-6 text-center">
            <h2 className="text-xl text-ink">Ready to stay fresh?</h2>
            <p className="mt-2 text-ink-2">
              ODORSTRIKE traps odor in your clothes in five seconds.
            </p>
            <div className="mt-4 flex justify-center">
              <LinkButton href="/product/odorstrike">
                Shop ODORSTRIKE — ₹229
              </LinkButton>
            </div>
          </div>
        </Container>
      </article>

      {related.length > 0 && (
        <Container className="border-t border-border py-12">
          <h2 className="text-xl">Related reads</h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/blog/${r.slug}`}
                  className="block rounded-xl border border-border p-4 no-underline hover:border-brand"
                >
                  <Tag>{r.category}</Tag>
                  <p className="mt-2 font-display font-semibold text-ink">
                    {r.title}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      )}
    </>
  );
}
