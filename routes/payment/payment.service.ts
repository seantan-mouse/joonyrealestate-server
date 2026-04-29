import Invoice from '../../models/Invoice'
import Payment from '../../models/Payment'
import {
    asNumber,
    asTrimmedString,
    collectValidationErrors,
    requireDateString,
    validateEnum
} from '../common/validation'
import type { CreatePaymentInput } from './payment.types'

function computeInvoiceLineItemTotal(invoice: {
    totalAmount?: number
    roomRate?: number
    nightlyRate?: number | null
    nights?: number | null
    electricityPrice?: number
    waterPrice?: number
    servicesFee?: number
}): number {
    const totalAmount = asNumber(invoice.totalAmount, 0)

    if (invoice.nights != null && invoice.nightlyRate != null) {
        return totalAmount
    }

    return (
        asNumber(invoice.roomRate, 0) +
        asNumber(invoice.electricityPrice, 0) +
        asNumber(invoice.waterPrice, 0) +
        asNumber(invoice.servicesFee, 0)
    )
}

function deriveInvoiceOutstanding(params: {
    invoice: {
        status?: string
        totalAmount?: number
        outstandingAmount?: number
        roomRate?: number
        nightlyRate?: number | null
        nights?: number | null
        electricityPrice?: number
        waterPrice?: number
        servicesFee?: number
    }
    totalPaid: number
}): number {
    const { invoice } = params
    const totalPaid = Math.max(0, asNumber(params.totalPaid, 0))
    const status = String(invoice.status ?? '').trim().toLowerCase()
    const explicitOutstanding = Math.max(0, asNumber(invoice.outstandingAmount, 0))
    const storedTotal = Math.max(0, asNumber(invoice.totalAmount, 0))
    const fallbackTotal = Math.max(0, computeInvoiceLineItemTotal(invoice))
    const collectibleTotal = Math.max(storedTotal, fallbackTotal)

    if (status === 'voided') {
        return 0
    }

    if (explicitOutstanding > 0) {
        return explicitOutstanding
    }

    if (
        status === 'paid' ||
        status === 'full'
    ) {
        return 0
    }

    if (
        status === 'partial' ||
        status === 'partially paid' ||
        status === 'not paid' ||
        status === 'notpaid' ||
        status === 'unpaid' ||
        status === 'new'
    ) {
        return Math.max(0, collectibleTotal - totalPaid)
    }

    if (collectibleTotal > 0) {
        return Math.max(0, collectibleTotal - totalPaid)
    }

    return 0
}

export async function createPaymentForInvoice(invoiceId: string, input: CreatePaymentInput) {
    const invoice = await Invoice.findById(invoiceId)
    if (!invoice) return { status: 'invoice_not_found' as const }

    const errors = collectValidationErrors([
        requireDateString(input.paymentDate, 'paymentDate'),
        validateEnum(input.type, ['full', 'partial'] as const, 'type')
    ])

    if (errors.length > 0) {
        return { status: 'validation_error' as const, errors }
    }

    const amount = asNumber(input.amount, 0)
    if (amount <= 0) {
        return { status: 'invalid_amount' as const }
    }

    const payment = await Payment.create({
        accountId: invoice.accountId ?? undefined,
        invoiceId: invoice._id,
        buildingId: invoice.buildingId,
        roomId: invoice.roomId,
        stayId: invoice.stayId ?? null,
        tenantId: invoice.tenantId ?? null,
        paymentDate: asTrimmedString(input.paymentDate),
        amount,
        type: input.type,
        method:
            input.method === 'bank' ||
            input.method === 'khqr' ||
            input.method === 'card' ||
            input.method === 'other'
                ? input.method
                : 'cash',
        notes: asTrimmedString(input.notes),
        source: 'manual'
    })

    const allPayments = await Payment.find({ invoiceId: invoice._id }).lean()
    const totalPaid = allPayments.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
    const outstandingAmount = deriveInvoiceOutstanding({
        invoice,
        totalPaid
    })

    invoice.outstandingAmount = outstandingAmount

    if (outstandingAmount === 0) {
        invoice.status = 'Paid'
    } else if (totalPaid > 0) {
        invoice.status = 'Partially paid'
    } else {
        invoice.status = 'Not paid'
    }

    await invoice.save()

    return {
        status: 'created' as const,
        payment,
        invoice
    }
}
