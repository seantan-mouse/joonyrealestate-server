import type { Request, Response } from 'express'
import { deleteInvoiceById } from './invoice.delete.service'
import { logRouteError } from '../common/logger'

export async function deleteInvoiceHandler(req: Request, res: Response) {
    try {
        const result = await deleteInvoiceById(req.params.id)

        if (result.status === 'invoice_not_found') {
            res.status(404).json({ error: 'Invoice not found' })
            return
        }

        res.sendStatus(200)
    } catch (error) {
        logRouteError('deleteInvoiceHandler', error, {
            invoiceId: req.params.id
        })
        res.status(500).json({ error: 'Failed to delete invoice' })
    }
}