import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream } from 'fs';

const ACCOUNT = process.env.R2_ACCOUNT_ID;
const KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET_NAME || 'jt-alwm-uploads';

export const HAS_R2 = !!(ACCOUNT && KEY && SECRET);

const s3 = HAS_R2
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: KEY, secretAccessKey: SECRET },
    })
  : null;

// URL présignée de lecture (les clips/audio référencés par le payload).
export async function presignRead(r2Key, expiresIn = 3600) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: r2Key }), { expiresIn });
}

export async function uploadFile(localPath, r2Key, contentType) {
  const up = new Upload({
    client: s3,
    params: { Bucket: BUCKET, Key: r2Key, Body: createReadStream(localPath), ContentType: contentType },
    queueSize: 3,
    partSize: 10 * 1024 * 1024,
  });
  await up.done();
}
