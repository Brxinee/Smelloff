export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-[70] rounded-lg bg-ink px-4 py-2 font-semibold text-bg focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
    >
      Skip to content
    </a>
  );
}
