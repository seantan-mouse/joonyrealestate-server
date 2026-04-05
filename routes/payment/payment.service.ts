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
    const outstandingAmount = Math.max(0, Number(invoice.totalAmount ?? 0) - totalPaid)

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
