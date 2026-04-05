import { Request, Response } from 'express'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3Client } from '../utilities/awsClients'
import keys from '../../config/keys'

export async function generateS3UploadUrl(req: Request, res: Response): Promise<void> {
    const { fileName, fileType } = req.body

    try {
        const command = new PutObjectCommand({
            Bucket: keys.s3BucketName,
            Key: fileName,
            ContentType: fileType
        })

        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 })
        res.status(200).json({ presignedUrl })
    } catch (error) {
        console.error('Error generating presigned URL:', error)
        res.status(500).json({ error: 'Error generating presigned URL' })
    }
}

export async function generateS3DownloadUrl(req: Request, res: Response): Promise<void> {
    const { key } = req.body

    try {
        const command = new GetObjectCommand({
            Bucket: keys.s3BucketName,
            Key: key
        })

        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 })
        res.status(200).json({ presignedUrl })
    } catch (err) {
        console.error('Error generating download URL:', err)
        res.status(500).json({ error: 'Error generating download URL' })
    }
}

export async function generateS3ViewUrl(req: Request, res: Response): Promise<void> {
    const { key } = req.body

    try {
        const command = new GetObjectCommand({
            Bucket: keys.s3BucketName,
            Key: key
        })

        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 })
        res.status(200).json({ presignedUrl })
    } catch (err) {
        console.error('Error generating view URL:', err)
        res.status(500).json({ error: 'Error generating presigned view URL' })
    }
}
