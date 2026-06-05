import { SITE } from "@/lib/constants";
import type { Product, Review, BlogMeta } from "@/types";
import { getReviewStats } from "@/lib/content";

/** Renders a JSON-LD <script>. */
function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function JsonLdOrganization() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE.name,
        url: SITE.url,
        email: SITE.email,
        sameAs: [SITE.instagram],
        address: {
          "@type": "PostalAddress",
          addressLocality: SITE.city,
          addressRegion: SITE.region,
          addressCountry: "IN",
        },
      }}
    />
  );
}

export function JsonLdProduct({ product }: { product: Product }) {
  const stats = getReviewStats();
  const visible = product.variants.filter((v) => !v.hidden && !v.trialOnly);
  const low = Math.min(...visible.map((v) => v.price));
  const high = Math.max(...visible.map((v) => v.price));

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.summary,
        image: `${SITE.url}${product.images[0]?.src ?? ""}`,
        brand: { "@type": "Brand", name: SITE.name },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: stats.average,
          reviewCount: stats.count,
        },
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "INR",
          lowPrice: low,
          highPrice: high,
          offerCount: visible.length,
          availability: "https://schema.org/InStock",
          url: `${SITE.url}/product/${product.handle}`,
        },
      }}
    />
  );
}

export function JsonLdArticle({ post }: { post: BlogMeta }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.excerpt,
        datePublished: post.date,
        author: { "@type": "Person", name: post.author },
        publisher: { "@type": "Organization", name: SITE.name },
        image: `${SITE.url}${post.hero}`,
      }}
    />
  );
}

export function JsonLdBreadcrumb({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.name,
          item: `${SITE.url}${it.url}`,
        })),
      }}
    />
  );
}

export function JsonLdReviews({ reviews }: { reviews: Review[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: reviews.map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: r.rating },
            author: { "@type": "Person", name: r.name },
            reviewBody: r.body,
          },
        })),
      }}
    />
  );
}
