/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "smelloff.in" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // Preserve SEO equity from the previous static site's .html URLs.
      { source: "/:path*.html", destination: "/:path*", permanent: true },
      { source: "/index", destination: "/", permanent: true },
      { source: "/blog/index", destination: "/blog", permanent: true },
      // Old "buy" anchor used across legacy pages.
      { source: "/buy", destination: "/product/odorstrike", permanent: false },
    ];
  },
};

export default nextConfig;
