import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "amvhcynichtwgnwxpnkv.supabase.co" }] },
};

export default nextConfig;
