import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false, // no anunciar la tecnología del servidor
  // Solo en desarrollo: probar desde un móvil en la misma Wi-Fi (npm run dev -- -H 0.0.0.0)
  allowedDevOrigins: ["192.168.*.*"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // El service worker nunca se cachea: cada visita comprueba si hay versión nueva
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

// Sentry (lib/sentry.ts). Los mapas de código se suben solo si hay SENTRY_AUTH_TOKEN (Vercel, producción)
// y se borran tras subirlos: sin token no se generan, así nunca se publican.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  widenClientFileUpload: true,
  telemetry: false,
  silent: !process.env.CI,
});
