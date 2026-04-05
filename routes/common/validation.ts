export function asTrimmedString(value: unknown): string {
    if (value === null || value === undefined) return ''
    return String(value).trim()
}

export function asNumber(value: unknown, fallback = 0): number {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
}

export function isPositiveNumber(value: unknown): boolean {
    const num = Number(value)
    return Number.isFinite(num) && num > 0
}

export function isNonNegativeNumber(value: unknown): boolean {
    const num = Number(value)
    return Number.isFinite(num) && num >= 0
}

export function requireString(value: unknown, fieldName: string): string | null {
    const normalized = asTrimmedString(value)
    return normalized ? null : `${fieldName} is required`
}

export function requireDateString(value: unknown, fieldName: string): string | null {
    const normalized = asTrimmedString(value)
    return normalized ? null : `${fieldName} is required`
}

export function validateEnum<T extends string>(
    value: unknown,
    allowed: readonly T[],
    fieldName: string
): string | null {
    const normalized = asTrimmedString(value)
    if (!normalized) return `${fieldName} is required`
    return allowed.includes(normalized as T) ? null : `${fieldName} is invalid`
}

export function collectValidationErrors(errors: Array<string | null>): string[] {
    return errors.filter((err): err is string => Boolean(err))
}