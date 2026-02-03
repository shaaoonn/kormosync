import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force webpack by providing a custom config
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;

