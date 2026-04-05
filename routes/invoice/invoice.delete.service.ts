import Invoice from '../../models/Invoice'
import Payment from '../../models/Payment'

export async function deleteInvoiceById(id: string) {
    const invoice = await Invoice.findById(id)
    if (!invoice) return { status: 'invoice_not_found' as const }

    await Payment.deleteMany({ invoiceId: invoice._id })
    await Invoice.findByIdAndDelete(id)

    return { status: 'deleted' as const }
}