import type { NextConfig } from "next";

// The CURRENT deployed CID — assets (_next/static/ + public/) are served from here.
// After each deploy: paste the NEW CID here, rebuild, redeploy (two-pass).
const ASSET_CID = "bafybeifvcp5etdmbinhm4acrl4dpuwzpzy6kwzm2jjwf226bxdnpqs7aye";
const ASSET_BASE = `https://ipfs.io/ipfs/${ASSET_CID}`;

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // CSS/JS chunks load from the known-good ASSET_CID on ipfs.io
  assetPrefix: ASSET_BASE,
  // Expose to page components so public/ image srcs can be prefixed too
  env: {
    NEXT_PUBLIC_IPFS_ASSET_BASE: ASSET_BASE,
  },
};

export default nextConfig;
