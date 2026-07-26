import type { NextConfig } from "next";

type RemotePattern = NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
>[number];

// Existing Vercel Blob images keep working while that store exists.
const remotePatterns: RemotePattern[] = [
  {
    protocol: "https",
    hostname: "*.public.blob.vercel-storage.com",
  },
];

// Allow the S3-compatible public storage host (Supabase/R2/etc.) if configured,
// so next/image can render newly uploaded photos.
const publicBase = process.env.S3_PUBLIC_BASE_URL;
if (publicBase) {
  try {
    const { protocol, hostname } = new URL(publicBase);
    remotePatterns.push({
      protocol: protocol.replace(":", "") as "http" | "https",
      hostname,
    });
  } catch {
    // Ignore a malformed S3_PUBLIC_BASE_URL — image optimization for that host
    // just won't be enabled.
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;
