import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Tag } from "@/components/ui/Tag";
import { getAllPosts, getFeaturedPost } from "@/lib/blog";
import type { BlogMeta } from "@/types";

export const metadata: Metadata = {
  title: "The Smelloff Blog — Odor Science & Grooming",
  description:
    "Practical guides on beating sweat smell, keeping clothes fresh and the science of fabric odor — from the makers of ODORSTRIKE.",
  alternates: { canonical: "/blog" },
};

function PostCard({ post }: { post: BlogMeta }) {
  return (
    <article className="card-hover group flex flex-col overflow-hidden rounded-2xl border border-border bg-bg">
      <Link
        href={`/blog/${post.slug}`}
        className="relative block aspect-[16/9] overflow-hidden bg-surface"
      >
        <Image
          src={post.hero}
          alt={post.heroAlt}
          fill
          sizes="(max-width: 768px) 90vw, 30vw"
          className="object-contain p-6 transition-transform duration-500 group-hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Tag>{post.category}</Tag>
        <h3 className="mt-3 text-lg">
          <Link href={`/blog/${post.slug}`} className="text-ink no-underline hover:text-brand">
            {post.title}
          </Link>
        </h3>
        <p className="mt-2 flex-1 text-sm text-ink-2">{post.excerpt}</p>
        <p className="mt-3 text-xs text-ink-3">{post.readTime}</p>
      </div>
    </article>
  );
}

export default function BlogIndexPage() {
  const featured = getFeaturedPost();
  const posts = getAllPosts().filter((p) => p.slug !== featured?.slug);

  return (
    <Container className="py-12">
      <SectionHeading
        eyebrow="The mag"
        title="Stay fresh, stay confident"
        subtitle="Odor science, grooming and everyday confidence — written plainly."
      />

      {featured && (
        <Link
          href={`/blog/${featured.slug}`}
          className="mt-10 grid gap-6 overflow-hidden rounded-2xl border border-border bg-surface no-underline md:grid-cols-2"
        >
          <div className="relative aspect-[16/10] bg-bg">
            <Image
              src={featured.hero}
              alt={featured.heroAlt}
              fill
              sizes="(max-width: 768px) 90vw, 45vw"
              className="object-contain p-8"
              priority
            />
          </div>
          <div className="flex flex-col justify-center p-6">
            <Tag>{featured.category}</Tag>
            <h2 className="mt-3 text-2xl text-ink">{featured.title}</h2>
            <p className="mt-3 text-ink-2">{featured.excerpt}</p>
            <p className="mt-4 text-sm font-semibold text-brand">
              Read article →
            </p>
          </div>
        </Link>
      )}

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </Container>
  );
}
