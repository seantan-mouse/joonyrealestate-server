import { S3Client } from '@aws-sdk/client-s3'
import { SESClient } from '@aws-sdk/client-ses'
import keys from '../../config/keys'

const region = 'ap-southeast-1'

export const s3Client = new S3Client({
    region,
    credentials: {
        accessKeyId: keys.AWS_ACCESS_KEY_ID!,
        secretAccessKey: keys.AWS_SECRET_ACCESS_KEY!
    }
})

export const sesClient = new SESClient({
    region,
    credentials: {
        accessKeyId: keys.AWS_ACCESS_KEY_ID!,
        secretAccessKey: keys.AWS_SECRET_ACCESS_KEY!
    }
})
