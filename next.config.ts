import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  // pdf-parse/mammoth bundle Node internals; keep them external to server bundling.
  serverExternalPackages: ["pdf-parse", "mammoth"],
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://salesiq.zohopublic.in" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/our-approach',
        destination: '/meritoways',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
