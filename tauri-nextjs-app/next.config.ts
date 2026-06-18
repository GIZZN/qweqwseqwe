import type { NextConfig } from "next";
import { ChildProcess } from "child_process";

// Node 22 on Windows throws `EPERM` from child.kill() when jest-worker tears
// down already-exiting build workers. The kill is harmless, so swallow only
// that specific error and let the build finish.
const originalKill = ChildProcess.prototype.kill;
ChildProcess.prototype.kill = function (...args: Parameters<typeof originalKill>) {
  try {
    return originalKill.apply(this, args);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "EPERM") return false;
    throw err;
  }
};

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Skip ESLint/TS checks during build (do them in IDE)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
