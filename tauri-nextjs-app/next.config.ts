import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Avoid Windows EPERM kill errors by disabling worker threads
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  // Skip ESLint/TS checks during build (do them in IDE)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
