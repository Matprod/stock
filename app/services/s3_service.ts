import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import env from '#start/env'
import { randomUUID } from 'node:crypto'
import { MultipartFile } from '@adonisjs/core/bodyparser'
import { readFileSync } from 'node:fs'

export default class S3Service {
  private s3Client: S3Client
  private bucketName: string

  constructor() {
    this.s3Client = new S3Client({
      region: env.get('AWS_REGION'),
      credentials: {
        accessKeyId: env.get('AWS_ACCESS_KEY'),
        secretAccessKey: env.get('AWS_SECRET_KEY'),
      },
    })
    this.bucketName = env.get('AWS_S3_IMAGE_BUCKET')
  }

  async uploadFile(
    file: MultipartFile,
    folder: string = 'uploads'
  ): Promise<{ key: string; url: string }> {
    const fileExtension = file.extname || 'jpg'
    const key = `${folder}/${randomUUID()}.${fileExtension}`

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: readFileSync(file.tmpPath!),
      ContentType: file.type || 'image/jpeg',
    })

    await this.s3Client.send(command)

    return { key, url: this.publicUrl(key) }
  }

  publicUrl(key: string): string {
    return `https://${this.bucketName}.s3.${env.get('AWS_REGION')}.amazonaws.com/${key}`
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    })

    await this.s3Client.send(command)
  }

  async getPresignedReadUrl(key: string, expiresInSec = 7200): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    })
    // SDK client generics differ between client-s3 and s3-request-presigner versions.
    return getSignedUrl(this.s3Client as never, command, { expiresIn: expiresInSec })
  }

  /** Download object bytes for offline PDF embedding (data URIs). */
  async getObjectBuffer(key: string): Promise<{ buffer: Buffer; contentType: string | null }> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    })
    const response = await this.s3Client.send(command)
    const body = response.Body
    if (!body) {
      throw new Error(`S3 empty body for key=${key}`)
    }
    const bytes = await body.transformToByteArray()
    return {
      buffer: Buffer.from(bytes),
      contentType: response.ContentType ?? null,
    }
  }
}
