import type { NextConfig } from "next";

/** URL de la API de NestJS. El navegador llama a /api/* y Next.js reenvía la petición (sin CORS). */
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  rewrites() {
    return [{ source: "/api/:ruta*", destination: `${API_URL}/api/:ruta*` }];
  },
};

export default nextConfig;
