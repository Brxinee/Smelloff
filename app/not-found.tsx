import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-6xl font-bold text-brand">404</p>
      <h1 className="mt-4 text-2xl">This page wandered off.</h1>
      <p className="mt-2 max-w-sm text-ink-2">
        The page you&apos;re looking for doesn&apos;t exist. Let&apos;s get you
        back to fresh.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <LinkButton href="/">Go home</LinkButton>
        <LinkButton href="/product/odorstrike" variant="secondary">
          Shop ODORSTRIKE
        </LinkButton>
      </div>
    </Container>
  );
}
