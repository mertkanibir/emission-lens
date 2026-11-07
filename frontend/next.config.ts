import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@emission-lens/backend", "@emission-lens/contracts"],
};

export default nextConfig;
