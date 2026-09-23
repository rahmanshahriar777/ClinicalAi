import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { ENV, type Env } from '../../config/env';

/**
 * S3-compatible object storage (MinIO locally). Used for exported documents
 * and attachments. Objects are addressed by opaque keys; presigned URLs are
 * short-lived and issued only after AccessPolicy checks in the caller.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: env.S3_ACCESS_KEY && env.S3_SECRET_KEY ? { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } : undefined,
    });
  }

  async putObject(key: string, body: Buffer | string, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: 'AES256' }));
    this.logger.debug({ key }, 'object stored');
  }

  async presignDownload(key: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }), { expiresIn: expiresInSeconds });
  }
}
