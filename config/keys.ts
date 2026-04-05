import dotenv from 'dotenv'

dotenv.config()

function requireEnv(...keys: string[]): string {
    for (const key of keys) {
        const value = String(process.env[key] ?? '').trim()
        if (value) return value
    }

    throw new Error(`Missing environment variable. Expected one of: ${keys.join(', ')}`)
}

const config = {
    mongoURI: requireEnv('MONGO_URI', 'MONGODB_URI'),
    cookieKey1: requireEnv('COOKIE_KEY_1'),
    cookieKey2: requireEnv('COOKIE_KEY_2'),
    cookieKey3: requireEnv('COOKIE_KEY_3'),
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID?.trim() || '',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY?.trim() || '',
    s3BucketName: requireEnv('S3_BUCKET_NAME'),
    appBaseDomain: process.env.APP_BASE_DOMAIN?.trim() || 'joonyrealestate.com',
    defaultAccountSlug: process.env.DEFAULT_ACCOUNT_SLUG?.trim().toLowerCase() || ''
}

export default config
