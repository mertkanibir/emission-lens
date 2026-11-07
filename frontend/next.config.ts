import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ["@emission-lens/backend", "@emission-lens/contracts"],
};

export default nextConfig;
