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
  experimental: {
    serverActions: { bodySizeLimit: "20mb" }, // upload de cifras, áudios e imagens
  },
};

export default nextConfig;
