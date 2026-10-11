import type { NextConfig } from "next";

// Optional static demo export; the normal local Next.js workflow is unchanged.
const staticDemo = process.env.STATIC_DEMO_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(staticDemo ? { output: "export" as const, basePath: "/flexpump-ai", trailingSlash: true } : {}),
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
