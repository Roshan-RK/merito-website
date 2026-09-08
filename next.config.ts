import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.io"],
  // @sparticuz/chromium's executablePath() resolves its bin/ binary via a
  // runtime-computed path, not a static import -- Vercel's file tracer can't
  // see that reference, so the binary silently doesn't ship with the
  // serverless function unless force-included here (confirmed live in prod:
  // "input directory .../@sparticuz/chromium/bin does not exist").
  outputFileTracingIncludes: {
    "/*": ["node_modules/@sparticuz/chromium/**/*"],
  },
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
      // Sept 2026 campaigns were built pointing at /fitment, which never
      // existed. Real destination is the #fit-checker anchor on /hub. Any
      // ?seg= query is preserved automatically. Temporary (307) -- this is a
      // safety net for stale ad URLs, not a permanent public path.
      {
        source: '/fitment',
        destination: '/hub#fit-checker',
        permanent: false,
      },
      {
        source: '/fitment/:path*',
        destination: '/hub#fit-checker',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
