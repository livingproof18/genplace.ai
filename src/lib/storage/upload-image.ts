import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client } from "@/lib/storage/r2-client";

type UploadImageParams = {
  buffer: Uint8Array | Buffer;
  key: string;
  contentType: string;
};

const CACHE_CONTROL = "public, max-age=31536000, immutable";

export async function uploadImage({
  buffer,
  key,
  contentType,
}: UploadImageParams) {
  const bucket = process.env.CF_R2_BUCKET;
  if (!bucket) {
    throw new Error("CF_R2_BUCKET is not configured.");
  }

  if (!key) {
    throw new Error("Upload key is required.");
  }

  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: CACHE_CONTROL,
    })
  );

  const baseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_R2_PUBLIC_BASE_URL is not configured.");
  }

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedKey = key.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedKey}`;
}
