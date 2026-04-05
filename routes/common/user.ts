export type SafeUser = {
    _id: string
    accountId?: string
    createdAt?: Date
    createdBy?: string
    name?: string
    email?: string
    role?: string
    remarks?: string
    accessToBuildings: string[]
}

type RoleLike = {
    name?: unknown
}

function toPlainObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object') {
        return {}
    }

    const maybeDoc = value as { toObject?: () => Record<string, unknown> }
    if (typeof maybeDoc.toObject === 'function') {
        return maybeDoc.toObject()
    }

    return { ...value as Record<string, unknown> }
}

export function normalizeUserRole(value: unknown): string {
    if (typeof value === 'string') {
        return value.trim()
    }

    if (value && typeof value === 'object') {
        const roleName = (value as RoleLike).name
        if (typeof roleName === 'string') {
            return roleName.trim()
        }
    }

    return ''
}

export function normalizeUserRoleLower(value: unknown): string {
    return normalizeUserRole(value).toLowerCase()
}

export function getUserAccessToBuildings(value: unknown): string[] {
    if (!value || typeof value !== 'object') {
        return []
    }

    const plain = value as { accessToBuildings?: unknown }
    if (!Array.isArray(plain.accessToBuildings)) {
        return []
    }

    return plain.accessToBuildings
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
}

export function getUserAccountId(value: unknown): string {
    if (!value || typeof value !== 'object') {
        return ''
    }

    const plain = value as { accountId?: unknown }
    return String(plain.accountId ?? '').trim()
}

export function sanitizeUser(user: unknown): SafeUser | null {
    const plain = toPlainObject(user)
    const id = String(plain._id ?? '').trim()

    if (!id) {
        return null
    }

    return {
        _id: id,
        accountId: getUserAccountId(plain) || undefined,
        createdAt: plain.createdAt instanceof Date ? plain.createdAt : undefined,
        createdBy: typeof plain.createdBy === 'string' ? plain.createdBy : undefined,
        name: typeof plain.name === 'string' ? plain.name : undefined,
        email: typeof plain.email === 'string' ? plain.email : undefined,
        role: normalizeUserRole(plain.role) || undefined,
        remarks: typeof plain.remarks === 'string' ? plain.remarks : undefined,
        accessToBuildings: getUserAccessToBuildings(plain)
    }
}
