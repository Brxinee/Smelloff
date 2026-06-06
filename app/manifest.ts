import type { MetadataRoute } from "next";

/** PWA web app manifest (ported/refreshed from the previous site). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smelloff — ODORSTRIKE",
    short_name: "Smelloff",
    description:
      "Pocket-sized fabric odor eliminator. Traps and neutralizes odor in your clothes. For fabrics only.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#0F6E78",
    icons: [
      { src: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
