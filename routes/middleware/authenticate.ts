import { NextFunction, Request, Response } from 'express'
import type { ParsedQs } from 'qs'
import type { RequestAccount } from './account'
import { getUserAccountId } from '../common/user'

export type AuthenticatedRequest<
    Params = Record<string, string>,
    ResBody = unknown,
    ReqBody = unknown,
    ReqQuery = ParsedQs
> = Request<Params, ResBody, ReqBody, ReqQuery> & {
    account?: RequestAccount | null
}

export function authenticate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    if (req.user) {
        const requestAccountId = String(req.account?.id ?? '').trim()
        const userAccountId = getUserAccountId(req.user)

        if (requestAccountId && requestAccountId !== userAccountId) {
            res.status(403).json({
                error: 'Forbidden'
            })
            return
        }

        next()
        return
    }

    res.status(401).json({
        error: 'Unauthorized'
    })
}
