import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  // NOTE: turbopack: {} was removed — it conflicts with the --webpack flag in package.json dev script
  // Having both causes HMR to break randomly, resulting in blank white pages
};

export default nextConfig;
