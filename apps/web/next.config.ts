import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `node .next/standalone/apps/web/server.js` runs the built app without node_modules.
  output: "standalone",
  // Trace from the repo root so workspace packages (packages/shared, packages/db) are included.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
