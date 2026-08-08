import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 blocks cross-origin /_next/* (incl. HMR) unless listed.
  // Loopback + LAN host needed for local Playwright and phone/LAN clients.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.2.98"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
