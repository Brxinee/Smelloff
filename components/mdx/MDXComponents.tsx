import Image from "next/image";
import Link from "next/link";
import type { MDXRemoteProps } from "next-mdx-remote/rsc";
import { Quote as QuoteIcon } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";

function Quote({
  children,
  author,
}: {
  children: React.ReactNode;
  author?: string;
}) {
  return (
    <figure className="my-6 border-l-4 border-brand pl-4">
      <QuoteIcon className="h-5 w-5 text-brand" aria-hidden />
      <blockquote className="mt-1 text-lg font-medium text-ink [&>p]:m-0">
        {children}
      </blockquote>
      {author && (
        <figcaption className="mt-1 text-sm text-ink-3">— {author}</figcaption>
      )}
    </figure>
  );
}

function PostImage({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="my-6 block overflow-hidden rounded-xl bg-surface">
      <Image
        src={src}
        alt={alt}
        width={800}
        height={500}
        className="h-auto w-full object-contain"
      />
    </span>
  );
}

function CTAInline() {
  return (
    <div className="my-8 rounded-2xl bg-surface p-6 text-center">
      <p className="mb-3 font-display text-lg font-semibold text-ink">
        Carry confidence in your pocket.
      </p>
      <LinkButton href="/product/odorstrike">Shop ODORSTRIKE — ₹229</LinkButton>
    </div>
  );
}

export const mdxComponents: MDXRemoteProps["components"] = {
  Callout,
  Quote,
  PostImage,
  CTAInline,
  a: ({ href = "#", children }) => (
    <Link href={href}>{children}</Link>
  ),
  h2: (props) => <h2 className="mt-10 text-2xl" {...props} />,
  h3: (props) => <h3 className="mt-8" {...props} />,
  p: (props) => <p className="my-4 leading-relaxed text-ink-2" {...props} />,
  ul: (props) => <ul className="my-4 list-disc space-y-1 pl-6 text-ink-2" {...props} />,
  ol: (props) => <ol className="my-4 list-decimal space-y-1 pl-6 text-ink-2" {...props} />,
};
