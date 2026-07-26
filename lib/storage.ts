import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * Provider-agnostic object storage (S3-compatible).
 *
 * Replaces Vercel Blob so the app can run outside Vercel (Railway, VPS, etc.).
 * Works with ANY S3-compatible backend by setting env vars:
 *   - Supabase Storage (free, no card)  ← recommended
 *   - Cloudflare R2
 *   - Backblaze B2
 *   - MinIO (self-hosted)
 *
 * Required env:
 *   S3_ENDPOINT           e.g. https://<proj>.supabase.co/storage/v1/s3
 *   S3_BUCKET             bucket name (must exist, public read for image URLs)
 *   S3_ACCESS_KEY_ID
 *   S3_SECRET_ACCESS_KEY
 *   S3_PUBLIC_BASE_URL    public URL prefix used to build the returned file URL,
 *                         e.g. https://<proj>.supabase.co/storage/v1/object/public/<bucket>
 * Optional env:
 *   S3_REGION             default "auto"
 *   S3_FORCE_PATH_STYLE   default "true" (Supabase/MinIO need path-style; R2 tolerates it)
 */

export interface StorageEnv {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  region: string;
  forcePathStyle: boolean;
}

export function getStorageEnv(): StorageEnv | null {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    return null;
  }

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
    region: process.env.S3_REGION || "auto",
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") !== "false",
  };
}

let cachedClient: S3Client | null = null;
let cachedKey = "";

function getClient(env: StorageEnv): S3Client {
  // Re-create the client only if the relevant config changed.
  const key = `${env.endpoint}|${env.region}|${env.accessKeyId}|${env.forcePathStyle}`;
  if (cachedClient && cachedKey === key) return cachedClient;

  cachedClient = new S3Client({
    endpoint: env.endpoint,
    region: env.region,
    forcePathStyle: env.forcePathStyle,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });
  cachedKey = key;
  return cachedClient;
}

export interface UploadResult {
  url: string;
  pathname: string;
  contentType: string;
}

/**
 * Uploads a file to the configured S3-compatible bucket with a unique key and
 * returns its public URL. Throws if storage is not configured.
 */
export async function uploadPublicObject(
  file: File,
  options?: { prefix?: string },
): Promise<UploadResult> {
  const env = getStorageEnv();
  if (!env) {
    throw new Error(
      "Object storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_BASE_URL.",
    );
  }

  const client = getClient(env);

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const prefix = options?.prefix ? `${options.prefix.replace(/\/+$/, "")}/` : "";
  const key = `${prefix}${Date.now()}-${randomSuffix}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const body = new Uint8Array(arrayBuffer);

  await client.send(
    new PutObjectCommand({
      Bucket: env.bucket,
      Key: key,
      Body: body,
      ContentType: file.type || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  const url = `${env.publicBaseUrl.replace(/\/+$/, "")}/${key}`;

  return {
    url,
    pathname: key,
    contentType: file.type || "application/octet-stream",
  };
}
