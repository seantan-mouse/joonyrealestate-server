import { Application, Request, Response } from 'express'
import User from '../models/User'
import { sanitizeUser, normalizeUserRole } from './common/user'
import { authenticate, type AuthenticatedRequest } from './middleware/authenticate'
import { requireAdmin } from './middleware/authorization'

type UserBody = Record<string, unknown>

function normalizeString(value: unknown): string {
    return String(value ?? '').trim()
}

function normalizeAccessToBuildings(value: unknown): string[] {
    if (!Array.isArray(value)) return []

    return value
        .map((item) => normalizeString(item))
        .filter(Boolean)
}

function buildCreateUserPayload(body: UserBody) {
    const email = normalizeString(body.email).toLowerCase()
    const password = normalizeString(body.password)

    if (!email) {
        return { status: 'invalid_email' as const }
    }

    if (!password) {
        return { status: 'invalid_password' as const }
    }

    return {
        status: 'ok' as const,
        payload: {
            createdAt: body.createdAt,
            createdBy: normalizeString(body.createdBy),
            name: normalizeString(body.name),
            email,
            password,
            role: normalizeUserRole(body.role),
            remarks: normalizeString(body.remarks),
            accessToBuildings: normalizeAccessToBuildings(body.accessToBuildings)
        }
    }
}

function buildUpdateUserPatch(body: UserBody) {
    const patch: Record<string, unknown> = {
        createdBy: normalizeString(body.createdBy),
        name: normalizeString(body.name),
        email: normalizeString(body.email).toLowerCase(),
        role: normalizeUserRole(body.role),
        remarks: normalizeString(body.remarks),
        accessToBuildings: normalizeAccessToBuildings(body.accessToBuildings)
    }

    const password = normalizeString(body.password)
    if (password) {
        patch.password = password
    }

    return patch
}

export default (app: Application) => {
    app.get('/api/users', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const users = await User.find({ accountId: req.account?.id }).sort({ name: 1 })
            res.json(users.map((user) => sanitizeUser(user)).filter(Boolean))
        } catch (err) {
            console.error('GET /api/users failed', err)
            res.status(500).json({ error: 'Failed to fetch users' })
        }
    })

    app.post('/api/user', authenticate, requireAdmin, async (req: AuthenticatedRequest<unknown, unknown, UserBody>, res: Response): Promise<void> => {
        try {
            const parsed = buildCreateUserPayload(req.body)

            if (parsed.status === 'invalid_email') {
                res.status(400).json({ error: 'Email is required' })
                return
            }

            if (parsed.status === 'invalid_password') {
                res.status(400).json({ error: 'Password is required' })
                return
            }

            const newUser = new User({
                ...parsed.payload,
                accountId: req.account?.id
            })
            await newUser.save()
            res.status(201).json(sanitizeUser(newUser))
        } catch (err) {
            console.error('POST /api/user failed', err)
            res.status(500).json({ error: 'Failed to create user' })
        }
    })

    app.put('/api/user/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest<{ id: string }, unknown, UserBody>, res: Response): Promise<void> => {
        try {
            const user = await User.findOne({
                _id: req.params.id,
                accountId: req.account?.id
            })

            if (!user) {
                res.status(404).json({ error: 'User not found' })
                return
            }

            Object.assign(user, buildUpdateUserPatch(req.body))
            await user.save()

            res.status(200).json(sanitizeUser(user))
        } catch (err: any) {
            console.error('PUT /api/user/:id failed', err)
            res.status(500).json({ error: err?.message ?? 'Failed to update user' })
        }
    })

    app.delete('/api/user/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
        try {
            const deletedUser = await User.findOneAndDelete({
                _id: req.params.id,
                accountId: req.account?.id
            })

            if (!deletedUser) {
                res.status(404).json({ error: 'User not found' })
                return
            }

            res.status(200).json(sanitizeUser(deletedUser))
        } catch (err) {
            console.error('DELETE /api/user/:id failed', err)
            res.status(500).json({ error: 'Failed to delete user' })
        }
    })
}
