import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.CF_R2_ACCOUNT_ID;
const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY;

if (!accountId) {
  throw new Error("CF_R2_ACCOUNT_ID is not configured.");
}
if (!accessKeyId) {
  throw new Error("CF_R2_ACCESS_KEY_ID is not configured.");
}
if (!secretAccessKey) {
  throw new Error("CF_R2_SECRET_ACCESS_KEY is not configured.");
}

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true,
});
