export type PersistedStayStatus = 'reserved' | 'active' | 'checked_out' | 'cancelled'
export type EffectiveStayStatus = PersistedStayStatus

type StayLike = {
    status?: string
    type?: string
    rentalStartDate?: string
    rentalEndDate?: string
    checkoutDate?: string
    cancelledAt?: string
}

function normalizeDate(value?: string): string {
    return String(value ?? '').trim()
}

function normalizeStatus(value?: string): PersistedStayStatus | '' {
    const s = String(value ?? '').trim().toLowerCase()

    if (s === 'reserved') return 'reserved'
    if (s === 'active') return 'active'
    if (s === 'checked_out') return 'checked_out'
    if (s === 'cancelled') return 'cancelled'

    return ''
}

export function deriveFallbackStayStatus(stay: Omit<StayLike, 'status'>): EffectiveStayStatus {
    const today = new Date().toISOString().slice(0, 10)

    const cancelledAt = normalizeDate(stay.cancelledAt)
    const checkoutDate = normalizeDate(stay.checkoutDate)
    const rentalStartDate = normalizeDate(stay.rentalStartDate)
    const rentalEndDate = normalizeDate(stay.rentalEndDate)
    const stayType = String(stay.type ?? '').trim().toLowerCase()
    const explicitEndDate = checkoutDate || rentalEndDate

    if (cancelledAt) return 'cancelled'
    if (checkoutDate && checkoutDate <= today) return 'checked_out'
    if (rentalStartDate && rentalStartDate > today) return 'reserved'
    if (stayType === 'daily') {
        if (explicitEndDate && explicitEndDate < today) return 'checked_out'
        if (!explicitEndDate && rentalStartDate && rentalStartDate < today) return 'checked_out'
    }

    return 'active'
}

export function getEffectiveStayStatus(stay: StayLike): EffectiveStayStatus {
    const persisted = normalizeStatus(stay.status)

    if (persisted === 'cancelled') {
        return 'cancelled'
    }

    if (persisted === 'checked_out') {
        return 'checked_out'
    }

    if (persisted === 'reserved' || persisted === 'active') {
        const today = new Date().toISOString().slice(0, 10)
        const rentalStartDate = normalizeDate(stay.rentalStartDate)
        const rentalEndDate = normalizeDate(stay.rentalEndDate)
        const checkoutDate = normalizeDate(stay.checkoutDate)
        const stayType = String(stay.type ?? '').trim().toLowerCase()
        const explicitEndDate = checkoutDate || rentalEndDate

        if (rentalStartDate && rentalStartDate > today) return 'reserved'
        if (stayType === 'daily') {
            if (explicitEndDate && explicitEndDate < today) return 'checked_out'
            if (!explicitEndDate && rentalStartDate && rentalStartDate < today) return 'checked_out'
        }

        return 'active'
    }

    return deriveFallbackStayStatus(stay)
}
