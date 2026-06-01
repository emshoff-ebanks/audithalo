import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Include the /rules YAML files in the deploy bundle so the runtime loader
  // can read them from disk inside Vercel Functions.
  outputFileTracingIncludes: {
    "/**/*": ["./rules/**/*.yaml", "./rules/**/*.yml"],
  },
};

export default nextConfig;
