import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { BlogMeta } from "@/types";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export interface BlogPost {
  meta: BlogMeta;
  content: string;
}

function readSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

export function getPostSlugs(): string[] {
  return readSlugs();
}

export function getPost(slug: string): BlogPost | null {
  const file = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  return {
    meta: { slug, ...(data as Omit<BlogMeta, "slug">) },
    content,
  };
}

export function getAllPosts(): BlogMeta[] {
  return readSlugs()
    .map((slug) => getPost(slug)?.meta)
    .filter((m): m is BlogMeta => Boolean(m))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export function getFeaturedPost(): BlogMeta | undefined {
  const posts = getAllPosts();
  return posts.find((p) => p.featured) ?? posts[0];
}

export function getRelatedPosts(slug: string, limit = 3): BlogMeta[] {
  return getAllPosts()
    .filter((p) => p.slug !== slug)
    .slice(0, limit);
}
