import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Минимальная сборка для Docker-образа web (Dockerfile.web).
  output: "standalone",
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
};

export default nextConfig;
