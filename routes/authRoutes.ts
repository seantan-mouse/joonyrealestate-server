import { Application, Response } from 'express'
import passport from 'passport'
import speakeasy from 'speakeasy'
import Account from '../models/Account'
import User from '../models/User'
import { getUserAccountId, sanitizeUser } from './common/user'
import { authenticate, AuthenticatedRequest } from './middleware/authenticate'

type VerifyTotpBody = {
    user?: {
        email?: string
    }
    secret?: string
    code?: string
}

type LoginBody = {
    email?: string
    password?: string
}

export default (app: Application) => {
    app.get(
        '/api/account-context',
        (req: AuthenticatedRequest, res: Response): void => {
            if (!req.account?.id) {
                res.status(400).json({ error: 'Account could not be resolved for this request' })
                return
            }

            res.status(200).json({
                _id: req.account.id,
                slug: req.account.slug,
                name: req.account.name,
                customDomains: req.account.customDomains,
                status: req.account.status,
                settings: req.account.settings ?? {},
                dataAccounts: req.account.dataAccounts ?? []
            })
        }
    )

    app.post(
        '/api/account-settings',
        authenticate,
        async (req: AuthenticatedRequest, res: Response): Promise<void> => {
            try {
                if (!req.account?.id) {
                    res.status(400).json({ error: 'Account could not be resolved for this request' })
                    return
                }

                const bookingColor = String((req.body as { bookingColor?: unknown })?.bookingColor ?? '').trim()

                const account = await Account.findByIdAndUpdate(
                    req.account.id,
                    {
                        $set: {
                            'settings.bookingColor': bookingColor || undefined
                        }
                    },
                    { new: true }
                )

                if (!account) {
                    res.status(404).json({ error: 'Account not found' })
                    return
                }

                res.status(200).json({ success: true })
            } catch (err) {
                console.error('POST /api/account-settings failed', err)
                res.status(500).json({ error: 'Server error' })
            }
        }
    )

    app.post(
        '/api/verify-totp',
        authenticate,
        async (
            req: AuthenticatedRequest<Record<string, string>, unknown, VerifyTotpBody>,
            res: Response
        ): Promise<void> => {
            try {
                const email = String(req.body?.user?.email ?? '').trim().toLowerCase()
                const code = String(req.body?.code ?? '').trim()

                if (!email || !code) {
                    res.status(400).json({ status: 'error', message: 'Email and TOTP code are required' })
                    return
                }

                const user = await User.findOne({ email })
                if (!user) {
                    res.status(400).json({ status: 'error', message: 'Invalid user' })
                    return
                }

                const secret = user.secret ?? String(req.body?.secret ?? '').trim()
                if (!secret) {
                    res.status(400).json({ status: 'error', message: 'TOTP secret is missing' })
                    return
                }

                const verified = speakeasy.totp.verify({
                    secret,
                    encoding: 'base32',
                    token: code,
                    window: 1
                })

                if (!verified) {
                    res.status(400).json({ status: 'error', message: 'Invalid TOTP code' })
                    return
                }

                if (!user.secret) {
                    user.secret = secret
                    await user.save()
                }

                res.status(200).json(sanitizeUser(user))
            } catch (err) {
                console.error('POST /api/verify-totp failed', err)
                res.status(500).json({ status: 'error', message: 'Server error' })
            }
        }
    )

    app.post(
        '/api/login',
        (
            req: AuthenticatedRequest<Record<string, string>, unknown, LoginBody>,
            res: Response,
            next
        ): void => {
            passport.authenticate('local', (err: unknown, user: any) => {
                if (err) {
                    console.error('POST /api/login auth error', err)
                    res.status(500).json({ error: 'Login failed' })
                    return
                }

                if (!user) {
                    res.status(401).json({ error: 'Invalid email or password' })
                    return
                }

                if (String(req.account?.id ?? '').trim() !== getUserAccountId(user)) {
                    res.status(403).json({ error: 'This user does not belong to the current account' })
                    return
                }

                req.logIn(user, (loginErr?: any) => {
                    if (loginErr) {
                        console.error('POST /api/login session error', loginErr)
                        res.status(500).json({ error: 'Login failed' })
                        return
                    }

                    res.status(200).json({ user: sanitizeUser(user) })
                })
            })(req, res, next)
        }
    )

    app.post(
        '/api/logout',
        (req: AuthenticatedRequest, res: Response): void => {
            req.logout((err?: any) => {
                if (err) {
                    console.error('POST /api/logout failed', err)
                    res.status(500).json({ error: 'Logout failed' })
                    return
                }

                req.session = null
                res.status(200).json({ success: true })
            })
        }
    )

    app.get(
        '/api/current_user',
        authenticate,
        (req: AuthenticatedRequest, res: Response): void => {
            res.json(sanitizeUser(req.user))
        }
    )
}
