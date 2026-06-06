import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Gallery } from "@/components/product/Gallery";
import { BuyBox } from "@/components/product/BuyBox";
import { BenefitBar } from "@/components/product/BenefitBar";
import { WhatItIsTable } from "@/components/product/WhatItIsTable";
import { ReviewSection } from "@/components/product/ReviewSection";
import { FaqAccordion } from "@/components/product/FaqAccordion";
import { StickyMobileCTA } from "@/components/product/StickyMobileCTA";
import { HowItWorks3Step } from "@/components/sections/HowItWorks3Step";
import { PriceLadder } from "@/components/sections/PriceLadder";
import {
  JsonLdProduct,
  JsonLdBreadcrumb,
  JsonLdReviews,
  JsonLdFaq,
} from "@/components/seo/JsonLd";
import {
  getAllProducts,
  getProduct,
  getReviews,
  getReviewStats,
  getFaq,
} from "@/lib/content";

export function generateStaticParams() {
  return getAllProducts().map((p) => ({ handle: p.handle }));
}

export function generateMetadata({
  params,
}: {
  params: { handle: string };
}): Metadata {
  const product = getProduct(params.handle);
  if (!product) return { title: "Product not found" };
  return {
    title: `${product.name} — Pocket Fabric Odor Mist`,
    description: product.summary,
    alternates: { canonical: `/product/${product.handle}` },
    openGraph: {
      title: product.name,
      description: product.summary,
      images: [{ url: product.images[0]?.src ?? "/og/og-default.jpg" }],
    },
  };
}

export default function ProductPage({
  params,
}: {
  params: { handle: string };
}) {
  const product = getProduct(params.handle);
  if (!product) notFound();

  const reviews = getReviews();
  const stats = getReviewStats();

  return (
    <>
      <JsonLdProduct product={product} />
      <JsonLdReviews reviews={reviews} />
      <JsonLdFaq faq={getFaq()} />
      <JsonLdBreadcrumb
        items={[
          { name: "Home", url: "/" },
          { name: "Shop", url: "/shop" },
          { name: product.name, url: `/product/${product.handle}` },
        ]}
      />

      <Container className="py-6">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-3">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="hover:text-brand">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/shop" className="hover:text-brand">
                Shop
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-ink-2">ODORSTRIKE</li>
          </ol>
        </nav>
      </Container>

      <Container className="grid gap-10 pb-16 lg:grid-cols-2">
        <Gallery images={product.images} />
        <BuyBox product={product} reviewStats={stats} />
      </Container>

      <Container className="pb-12">
        <BenefitBar />
      </Container>

      <section className="section-y bg-surface" aria-labelledby="why-h">
        <Container className="max-w-3xl">
          <h2 id="why-h">Why clothes hold odor</h2>
          <p className="mt-4 text-ink-2">
            Sweat itself is nearly odorless. Skin bacteria break it into volatile
            compounds that embed in fabric — and synthetics like polyester hold
            onto them and re-release the smell across wears, sometimes even after
            washing. ODORSTRIKE targets the fabric, not your skin.{" "}
            <Link href="/how-it-works" className="underline">
              Read the full science →
            </Link>
          </p>
        </Container>
      </section>

      <HowItWorks3Step withCta={false} />

      <section className="section-y bg-bg" aria-labelledby="compare-h">
        <Container className="max-w-3xl">
          <h2 id="compare-h" className="mb-6 text-center">
            ODORSTRIKE vs perfume vs deodorant
          </h2>
          <WhatItIsTable />
          <p className="mt-4 text-center text-sm text-ink-3">
            For use on fabrics and clothing only. Not for application to skin.
          </p>
        </Container>
      </section>

      <ReviewSection reviews={reviews} />

      <FaqAccordion />

      <section className="section-y bg-surface" aria-labelledby="stock-h">
        <Container>
          <h2 id="stock-h" className="text-center">
            Stock up &amp; save
          </h2>
        </Container>
        <PriceLadder />
      </section>

      <ProductInfoBlock />

      <StickyMobileCTA product={product} />
    </>
  );
}

function ProductInfoBlock() {
  const product = getProduct("odorstrike");
  if (!product) return null;
  const info = product.info;
  return (
    <section className="border-t border-border bg-bg py-12" aria-labelledby="info-h">
      <Container className="max-w-3xl">
        <h2 id="info-h" className="text-xl">
          Product information
        </h2>
        <dl className="mt-4 grid gap-2 text-sm text-ink-2 sm:grid-cols-2">
          <div>{info.netQuantity}</div>
          <div>{info.mrpNote}</div>
          <div>{info.manufacturer}</div>
          <div>{info.marketer}</div>
          <div>{info.manufactureDate}</div>
          <div>{info.countryOfOrigin}</div>
          <div className="sm:col-span-2">{info.consumerCare}</div>
        </dl>
        <p className="mt-4 text-sm text-ink-3">
          <strong>Ingredients:</strong> {product.ingredients}
        </p>
      </Container>
    </section>
  );
}
