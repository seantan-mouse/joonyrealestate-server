import type { NextFunction, Response } from 'express'
import Account from '../../models/Account'
import type { AuthenticatedRequest } from './authenticate'

export type RequestAccount = {
    id: string
    slug: string
    name: string
    customDomains: string[]
    status: 'active' | 'inactive'
}

function normalizeHost(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/:\d+$/, '')
}

function parseUrlHost(value: unknown): string {
    const raw = String(value ?? '').trim()
    if (!raw) return ''

    try {
        return normalizeHost(new URL(raw).host)
    } catch {
        return ''
    }
}

function getRequestHost(req: AuthenticatedRequest): string {
    const forwardedHost = req.headers['x-forwarded-host']

    if (Array.isArray(forwardedHost) && forwardedHost.length > 0) {
        return normalizeHost(forwardedHost[0])
    }

    if (typeof forwardedHost === 'string' && forwardedHost.trim()) {
        return normalizeHost(forwardedHost.split(',')[0])
    }

    return normalizeHost(req.headers.host)
}

function getOriginHost(req: AuthenticatedRequest): string {
    const origin = req.headers.origin

    if (Array.isArray(origin) && origin.length > 0) {
        const parsed = parseUrlHost(origin[0])
        if (parsed) return parsed
    }

    if (typeof origin === 'string' && origin.trim()) {
        const parsed = parseUrlHost(origin)
        if (parsed) return parsed
    }

    const referer = req.headers.referer

    if (Array.isArray(referer) && referer.length > 0) {
        const parsed = parseUrlHost(referer[0])
        if (parsed) return parsed
    }

    if (typeof referer === 'string' && referer.trim()) {
        return parseUrlHost(referer)
    }

    return ''
}

function getAccountSlugFromHeader(req: AuthenticatedRequest): string {
    const raw = req.headers['x-account-slug']
    if (Array.isArray(raw)) return String(raw[0] ?? '').trim().toLowerCase()
    return String(raw ?? '').trim().toLowerCase()
}

function inferSlugFromHost(host: string): string {
    if (!host) return ''

    const baseDomain = String(process.env.APP_BASE_DOMAIN ?? 'joonyrealestate.com')
        .trim()
        .toLowerCase()

    if (!baseDomain) return ''
    if (host === baseDomain || host === `www.${baseDomain}`) return ''
    if (!host.endsWith(`.${baseDomain}`)) return ''

    const prefix = host.slice(0, -(baseDomain.length + 1))
    const firstLabel = prefix.split('.')[0]?.trim().toLowerCase() ?? ''

    if (!firstLabel || ['www', 'app', 'api'].includes(firstLabel)) {
        return ''
    }

    return firstLabel
}

function isLocalHost(host: string): boolean {
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')
}

function isApiHost(host: string): boolean {
    const baseDomain = String(process.env.APP_BASE_DOMAIN ?? 'joonyrealestate.com')
        .trim()
        .toLowerCase()

    return Boolean(baseDomain) && host === `api.${baseDomain}`
}

function toRequestAccount(value: {
    _id: unknown
    slug?: string
    name?: string
    customDomains?: string[]
    status?: 'active' | 'inactive'
}): RequestAccount {
    return {
        id: String(value._id ?? ''),
        slug: String(value.slug ?? ''),
        name: String(value.name ?? ''),
        customDomains: Array.isArray(value.customDomains)
            ? value.customDomains.map((item) => String(item ?? '').trim().toLowerCase()).filter(Boolean)
            : [],
        status: value.status === 'inactive' ? 'inactive' : 'active'
    }
}

async function findAccountBySlug(slug: string): Promise<RequestAccount | null> {
    if (!slug) return null

    const account = await Account.findOne({ slug, status: 'active' })
        .select('_id slug name customDomains status')
        .lean()

    return account ? toRequestAccount(account) : null
}

async function findAccountByHost(host: string): Promise<RequestAccount | null> {
    if (!host) return null

    const customDomainAccount = await Account.findOne({
        customDomains: host,
        status: 'active'
    })
        .select('_id slug name customDomains status')
        .lean()

    if (customDomainAccount) {
        return toRequestAccount(customDomainAccount)
    }

    const slugFromHost = inferSlugFromHost(host)
    return findAccountBySlug(slugFromHost)
}

async function findAccountForRequest(req: AuthenticatedRequest): Promise<RequestAccount | null> {
    const headerSlug = getAccountSlugFromHeader(req)
    if (headerSlug) {
        const account = await findAccountBySlug(headerSlug)
        if (account) return account
    }

    const requestHost = getRequestHost(req)
    const originHost = getOriginHost(req)

    const candidateHosts = new Set<string>()

    if (isApiHost(requestHost) || isLocalHost(requestHost)) {
        if (originHost) candidateHosts.add(originHost)
        if (requestHost) candidateHosts.add(requestHost)
    } else {
        if (requestHost) candidateHosts.add(requestHost)
        if (originHost) candidateHosts.add(originHost)
    }

    for (const host of candidateHosts) {
        const account = await findAccountByHost(host)
        if (account) {
            return account
        }
    }

    if (isLocalHost(requestHost)) {
        const defaultSlug = String(process.env.DEFAULT_ACCOUNT_SLUG ?? '').trim().toLowerCase()

        if (defaultSlug) {
            const account = await findAccountBySlug(defaultSlug)
            if (account) return account
        }

        const accounts = await Account.find({ status: 'active' })
            .select('_id slug name customDomains status')
            .sort({ name: 1 })
            .lean<Array<{
                _id: unknown
                slug?: string
                name?: string
                customDomains?: string[]
                status?: 'active' | 'inactive'
            }>>()

        if (accounts.length === 1) {
            return toRequestAccount(accounts[0])
        }
    }

    return null
}

export async function attachAccountContext(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    try {
        req.account = await findAccountForRequest(req)
        next()
    } catch (error) {
        console.error('account resolution failed', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

export function requireResolvedAccount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    if (req.account?.id) {
        next()
        return
    }

    res.status(400).json({ error: 'Account could not be resolved for this request' })
}
