import express, { Application } from 'express'
import mongoose from 'mongoose'
import cookieSession from 'cookie-session'
import bodyParser from 'body-parser'
import passport from 'passport'
import authRoutes from './routes/authRoutes'
import userRoutes from './routes/userRoutes'
import buildingRoutes from './routes/buildingRoutes'
import keys from './config/keys'
import { attachAccountContext, requireResolvedAccount } from './routes/middleware/account'

import './models/User'
import './models/Account'
import './services/passport'

async function bootstrap() {
    await mongoose.connect(keys.mongoURI)

    const app: Application = express()

    app.use(
        cookieSession({
            maxAge: 30 * 24 * 60 * 60 * 1000,
            keys: [keys.cookieKey1, keys.cookieKey2, keys.cookieKey3]
        })
    )
    app.use(bodyParser.json({ limit: '50mb' }))
    app.use(bodyParser.urlencoded({ extended: false }))

    app.use(passport.initialize())
    app.use(passport.session())
    app.set('trust proxy', true)

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
