import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Force webpack by providing a custom config
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;

