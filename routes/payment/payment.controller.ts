import { Request, Response } from 'express'
import { createPaymentForInvoice } from './payment.service'
import { logRouteError } from '../common/logger'

export async function createPaymentForInvoiceHandler(req: Request, res: Response): Promise<void> {
    try {
        const result = await createPaymentForInvoice(req.params.id, req.body)

        if (result.status === 'invoice_not_found') {
            res.status(404).send('Invoice not found')
            return
        }

        if (result.status === 'validation_error') {
            res.status(400).json({ errors: result.errors })
            return
        }

        if (result.status === 'invalid_amount') {
            res.status(400).send('Payment amount must be greater than zero')
            return
        }

        res.status(201).json({
            payment: result.payment,
            invoice: result.invoice
        })
    } catch (err) {
        logRouteError('POST /api/invoice/:id/payments', err, { invoiceId: req.params.id })
        res.status(500).send('Internal server error')
    }
}