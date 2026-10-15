import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel uses its own serverless build, NOT Next.js standalone output.
  // Setting `output: "standalone"` here produces a wrong artifact for Vercel
  // and breaks serverless function resolution. Leave it off for Vercel deploys.
  // (For self-hosted Docker, you can re-enable it via a separate config.)
  output: undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Vercel: Prisma needs to be bundled in the serverless function output.
  // This is handled by the @prisma/client postinstall, but we also need
  // to make sure the schema file is included.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
