import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pladuk/shared"],
  experimental: {
    optimizePackageImports: [
      "motion/react",
      "gsap",
      "qrcode.react",
      "sonner",
      "@tanstack/react-query",
    ],
  },
};

export default nextConfig;
