import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import env from '#start/env';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
export default class S3Service {
    s3Client;
    bucketName;
    constructor() {
        this.s3Client = new S3Client({
            region: env.get('AWS_REGION'),
            credentials: {
                accessKeyId: env.get('AWS_ACCESS_KEY'),
                secretAccessKey: env.get('AWS_SECRET_KEY'),
            },
        });
        this.bucketName = env.get('AWS_S3_IMAGE_BUCKET');
    }
    async uploadFile(file, folder = 'uploads') {
        const fileExtension = file.extname || 'jpg';
        const key = `${folder}/${randomUUID()}.${fileExtension}`;
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: readFileSync(file.tmpPath),
            ContentType: file.type || 'image/jpeg',
        });
        await this.s3Client.send(command);
        const url = `https://${this.bucketName}.s3.${env.get('AWS_REGION')}.amazonaws.com/${key}`;
        return { key, url };
    }
    async deleteFile(key) {
        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });
        await this.s3Client.send(command);
    }
}
//# sourceMappingURL=s3_service.js.map