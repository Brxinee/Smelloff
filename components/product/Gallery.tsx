"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/types";

export function Gallery({ images }: { images: ProductImage[] }) {
  const [active, setActive] = React.useState(0);
  const [zoom, setZoom] = React.useState(false);
  const current = images[active] ?? images[0];

  if (!current) return null;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setZoom((z) => !z)}
        className="relative aspect-square w-full overflow-hidden rounded-2xl bg-surface"
        aria-label={zoom ? "Zoom out" : "Zoom in"}
      >
        <Image
          src={current.src}
          alt={current.alt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority={active === 0}
          className={cn(
            "object-contain p-6 transition-transform duration-300",
            zoom ? "scale-150 cursor-zoom-out" : "cursor-zoom-in"
          )}
        />
      </button>

      <div className="no-scrollbar flex gap-3 overflow-x-auto" role="tablist" aria-label="Product images">
        {images.map((img, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`View image ${i + 1}`}
            onClick={() => {
              setActive(i);
              setZoom(false);
            }}
            className={cn(
              "relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-surface",
              i === active ? "border-brand" : "border-border"
            )}
          >
            <Image
              src={img.src}
              alt=""
              fill
              sizes="80px"
              className="object-contain p-1"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
