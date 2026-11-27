import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Painel é 100% dinâmico (sessão por requisição); Cache Components fica desligado.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // App dos membros (Expo exportado para web em public/app): qualquer rota do app abre o index.html dele.
  async rewrites() {
    return { beforeFiles: [], afterFiles: [], fallback: [{ source: "/app/:path*", destination: "/app/index.html" }] };
  },
  async headers() {
    return [
      { source: "/app/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/app" }] },
      { source: "/app/manifest.webmanifest", headers: [{ key: "Content-Type", value: "application/manifest+json" }] },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: "20mb" }, // upload de cifras, áudios e imagens
  },
};

export default nextConfig;
