import express, { Application, NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import cookieSession from 'cookie-session'
import bodyParser from 'body-parser'
import passport from 'passport'
import authRoutes from './routes/authRoutes'
import userRoutes from './routes/userRoutes'
import buildingRoutes from './routes/buildingRoutes'
import keys from './config/keys'
import Account from './models/Account'
import { attachAccountContext, requireResolvedAccount } from './routes/middleware/account'

import './models/User'
import './models/Account'
import './services/passport'

function normalizeHost(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/:\d+$/, '')
}

function parseOriginHost(origin: string): string {
    try {
        return normalizeHost(new URL(origin).host)
    } catch {
        return ''
    }
}

function isLocalHost(host: string): boolean {
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')
}

async function isAllowedCorsOrigin(origin: string): Promise<boolean> {
    const host = parseOriginHost(origin)
    if (!host) return false

    if (isLocalHost(host)) {
        return true
    }

    const baseDomain = String(keys.appBaseDomain ?? 'joonyrealestate.com').trim().toLowerCase()

    if (baseDomain && (host === baseDomain || host === `www.${baseDomain}` || host.endsWith(`.${baseDomain}`))) {
        return true
    }

    return Boolean(
        await Account.exists({
            customDomains: host,
            status: 'active'
        })
    )
}

async function bootstrap() {
    await mongoose.connect(keys.mongoURI)

    const app: Application = express()
    const isProduction = process.env.NODE_ENV === 'production'

    app.set('trust proxy', true)

    app.use(async (req: Request, res: Response, next: NextFunction) => {
        const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : ''

        if (origin) {
            const allowed = await isAllowedCorsOrigin(origin)

            if (allowed) {
                res.setHeader('Access-Control-Allow-Origin', origin)
                res.setHeader('Access-Control-Allow-Credentials', 'true')
                res.setHeader('Vary', 'Origin')
            } else if (req.method === 'OPTIONS') {
                res.status(403).json({ error: 'Origin not allowed' })
                return
            }
        }

        res.setHeader(
            'Access-Control-Allow-Headers',
            'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-account-slug'
        )
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')

        if (req.method === 'OPTIONS') {
            res.sendStatus(204)
            return
        }

        next()
    })

    app.use(
        cookieSession({
            name: 'joonyrealestate_session',
            maxAge: 30 * 24 * 60 * 60 * 1000,
            keys: [keys.cookieKey1, keys.cookieKey2, keys.cookieKey3],
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax'
        })
    )
    app.use(bodyParser.json({ limit: '50mb' }))
    app.use(bodyParser.urlencoded({ extended: false }))

    app.use(passport.initialize())
    app.use(passport.session())

    app.get('/health', (_req, res) => {
        res.status(200).json({ ok: true })
    })

    app.use('/api', attachAccountContext, requireResolvedAccount)

    authRoutes(app)
    userRoutes(app)
    buildingRoutes(app)

    const PORT = Number(process.env.PORT ?? 8004)
    app.listen(PORT, () => {
        console.log(`Joony Real Estate API listening on port ${PORT}`)
    })
}

bootstrap().catch((error) => {
    console.error('Failed to start API', error)
    process.exit(1)
})
