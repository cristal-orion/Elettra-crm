import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Upload documenti (PDF/disegni/foto): alza il limite del body dei
      // server action (default 1MB). Lasciare margine per l'overhead multipart.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
