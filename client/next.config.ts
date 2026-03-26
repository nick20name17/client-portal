import type { NextConfig } from "next";

const backend = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
