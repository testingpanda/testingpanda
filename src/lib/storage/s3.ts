import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/env";
import type { StorageDriver } from "@/lib/storage";

/**
 * S3-compatible object storage driver (works against AWS S3, MinIO, R2,
 * Backblaze B2, etc). Objects are written with server-side encryption
 * enabled AND already-encrypted application-level ciphertext (defense in
 * depth) — see src/lib/crypto. Bucket ACLs should be private-only; this app
 * never relies on public bucket access.
 */
export class S3StorageDriver implements StorageDriver {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const env = getEnv();
    this.bucket = env.STORAGE_S3_BUCKET!;
    this.client = new S3Client({
      region: env.STORAGE_S3_REGION,
      endpoint: env.STORAGE_S3_ENDPOINT || undefined,
      forcePathStyle: env.STORAGE_S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.STORAGE_S3_ACCESS_KEY_ID!,
        secretAccessKey: env.STORAGE_S3_SECRET_ACCESS_KEY!,
      },
    });
  }

  async put(key: string, data: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ServerSideEncryption: "AES256",
      })
    );
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const stream = result.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
