import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@rdat/ui", "@rdat/shared", "@rdat/types"]
};

export default nextConfig;
