import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/**/*": ["./rules/**/*.yaml", "./rules/**/*.yml"],
  },
  async redirects() {
    return [
      {
        source: "/for-practices",
        destination: "/for-group-practices",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
