import { Hero } from "@/components/sections/Hero";
import { TrustBar } from "@/components/sections/TrustBar";
import { ProblemSolution } from "@/components/sections/ProblemSolution";
import { HowItWorks3Step } from "@/components/sections/HowItWorks3Step";
import { PriceLadder } from "@/components/sections/PriceLadder";
import { SocialProof } from "@/components/sections/SocialProof";
import { UseCaseGrid } from "@/components/sections/UseCaseGrid";
import { FounderNote } from "@/components/sections/FounderNote";
import { FaqAccordion } from "@/components/product/FaqAccordion";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Newsletter } from "@/components/sections/Newsletter";
import { JsonLdProduct, JsonLdFaq } from "@/components/seo/JsonLd";
import { getDefaultProduct, getFaq } from "@/lib/content";

export default function HomePage() {
  const product = getDefaultProduct();
  return (
    <>
      <JsonLdProduct product={product} />
      <JsonLdFaq faq={getFaq()} />
      <Hero />
      <TrustBar />
      <ProblemSolution />
      <HowItWorks3Step />
      <PriceLadder />
      <SocialProof />
      <UseCaseGrid />
      <FounderNote />
      <FaqAccordion />
      <FinalCTA />
      <Newsletter />
    </>
  );
}
