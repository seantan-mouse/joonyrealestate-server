import { Application } from 'express'
import Counter from '../models/Counter'
import { authenticate } from './middleware/authenticate'
import {
    requireAdmin,
    requireBuildingAccessFromBuildingParam,
    requireBuildingAccessFromDocumentParam,
    requireBuildingAccessFromExpenseParam,
    requireBuildingAccessFromInvoiceParam,
    requireBuildingAccessFromReadingParam,
    requireBuildingAccessFromRoomParam,
    requireBuildingAccessFromServiceParam,
    requireSelfOrAdmin
} from './middleware/authorization'
import {
    createBuildingHandler,
    deleteBuildingHandler,
    getBuildingDetail,
    getBuildingOccupancyHandler,
    getBuildingPaymentsOverviewHandler,
    getBuildingRoomsHandler,
    listBuildings,
    listBuildingsForUser,
    updateBuildingHandler
} from './building/building.controller'
import { getDashboardOverviewHandler } from './dashboard/dashboard.controller'
import {
    getBuildingReportHandler,
    getPortfolioBookingPlanHandler,
    getPortfolioReportHandler
} from './report/report.controller'
import {
    createExpenseForBuildingHandler,
    deleteExpenseHandler,
    listExpensesForBuildingHandler,
    updateExpenseHandler
} from './expense/expense.controller'
import { getSettings, updateSettings } from './settings/settings.controller'
import { generateS3DownloadUrl, generateS3UploadUrl, generateS3ViewUrl } from './storage/storage.controller'
import { createRoomHandler, getRoomDetailHandler, updateRoomHandler } from './room/room.controller'
import { createStayForRoomHandler, checkoutStayForRoomHandler, updateStayForRoomHandler } from './stay/stay.controller'
import { createReadingForRoomHandler } from './reading/reading.controller'
import { createInvoiceForRoomHandler } from './invoice/invoice.controller'
import { createPaymentForInvoiceHandler } from './payment/payment.controller'
import { createDocumentForRoomHandler, deleteDocumentHandler } from './document/document.controller'
import { createServiceForRoomHandler, deleteServiceHandler } from './service/service.controller'
import { deleteReadingHandler } from './reading/reading.delete.controller'
import { deleteInvoiceHandler } from './invoice/invoice.delete.controller'

export default (app: Application) => {
    app.get('/api/dashboard/overview', authenticate, requireAdmin, getDashboardOverviewHandler)
    app.get('/api/reports/portfolio', authenticate, getPortfolioReportHandler)
    app.get('/api/reports/portfolio/booking-plan', authenticate, getPortfolioBookingPlanHandler)

    app.get('/api/buildings', authenticate, requireAdmin, listBuildings)
    app.get('/api/buildings/:userid', authenticate, requireSelfOrAdmin('userid'), listBuildingsForUser)
    app.post('/api/building', authenticate, requireAdmin, createBuildingHandler)
    app.get('/api/building/:id', authenticate, requireBuildingAccessFromBuildingParam('id'), getBuildingDetail)
    app.put('/api/building/:id', authenticate, requireBuildingAccessFromBuildingParam('id'), updateBuildingHandler)
    app.get('/api/building/:id/rooms', authenticate, requireBuildingAccessFromBuildingParam('id'), getBuildingRoomsHandler)
    app.get('/api/building/:id/occupancy', authenticate, requireBuildingAccessFromBuildingParam('id'), getBuildingOccupancyHandler)
    app.get('/api/building/:id/payments-overview', authenticate, requireBuildingAccessFromBuildingParam('id'), getBuildingPaymentsOverviewHandler)
    app.get('/api/building/:id/report', authenticate, requireBuildingAccessFromBuildingParam('id'), getBuildingReportHandler)
    app.delete('/api/building/:id', authenticate, requireAdmin, deleteBuildingHandler)

    app.get('/api/building/:buildingId/expenses', authenticate, requireBuildingAccessFromBuildingParam('buildingId'), listExpensesForBuildingHandler)
    app.post('/api/building/:buildingId/expenses', authenticate, requireBuildingAccessFromBuildingParam('buildingId'), createExpenseForBuildingHandler)
    app.put('/api/expense/:id', authenticate, requireBuildingAccessFromExpenseParam('id'), updateExpenseHandler)
    app.delete('/api/expense/:id', authenticate, requireBuildingAccessFromExpenseParam('id'), deleteExpenseHandler)

    app.get('/api/room/:id', authenticate, requireBuildingAccessFromRoomParam('id'), getRoomDetailHandler)
    app.post('/api/building/:buildingId/rooms', authenticate, requireBuildingAccessFromBuildingParam('buildingId'), createRoomHandler)
    app.put('/api/room/:id', authenticate, requireBuildingAccessFromRoomParam('id'), updateRoomHandler)
    app.post('/api/room/:id/stays', authenticate, requireBuildingAccessFromRoomParam('id'), createStayForRoomHandler)
    app.put('/api/room/:id/stays/:stayId', authenticate, requireBuildingAccessFromRoomParam('id'), updateStayForRoomHandler)
    app.post('/api/room/:id/readings', authenticate, requireBuildingAccessFromRoomParam('id'), createReadingForRoomHandler)
    app.post('/api/room/:id/invoices', authenticate, requireBuildingAccessFromRoomParam('id'), createInvoiceForRoomHandler)
    app.post('/api/invoice/:id/payments', authenticate, requireBuildingAccessFromInvoiceParam('id'), createPaymentForInvoiceHandler)

    app.post('/api/room/:id/documents', authenticate, requireBuildingAccessFromRoomParam('id'), createDocumentForRoomHandler)
    app.delete('/api/document/:id', authenticate, requireBuildingAccessFromDocumentParam('id'), deleteDocumentHandler)

    app.post('/api/room/:id/services', authenticate, requireBuildingAccessFromRoomParam('id'), createServiceForRoomHandler)
    app.post('/api/room/:id/checkout', authenticate, requireBuildingAccessFromRoomParam('id'), checkoutStayForRoomHandler)
    app.delete('/api/service/:id', authenticate, requireBuildingAccessFromServiceParam('id'), deleteServiceHandler)
    app.delete('/api/reading/:id', authenticate, requireBuildingAccessFromReadingParam('id'), deleteReadingHandler)
    app.delete('/api/invoice/:id', authenticate, requireBuildingAccessFromInvoiceParam('id'), deleteInvoiceHandler)

    app.get('/api/settings', authenticate, getSettings)
    app.put('/api/settings', authenticate, requireAdmin, updateSettings)

    app.post('/api/increment_invoice_number', authenticate, requireAdmin, async (_req, res) => {
        try {
            const result = await Counter.findOneAndUpdate(
                { name: 'invoiceNumber' },
                { $inc: { value: 1 } },
                { new: true, upsert: true }
            )

            res.status(200).json({ invoiceNumber: result?.value ?? 0 })
        } catch (err) {
            res.status(500).json({ error: 'Failed to increment invoice number', details: err })
        }
    })

    app.get('/api/invoice_number', authenticate, requireAdmin, async (_req, res) => {
        try {
            const counter = await Counter.findOne({ name: 'invoiceNumber' })

            if (counter) {
                res.status(200).json(counter.value)
            } else {
                res.status(404).json({ error: 'Invoice number not found' })
            }
        } catch (err) {
            res.status(500).json({ error: 'Failed to fetch invoice number', details: err })
        }
    })

    app.post('/api/generate-s3-bucket-url', authenticate, generateS3UploadUrl)
    app.post('/api/generate-s3-download-url', authenticate, generateS3DownloadUrl)
    app.post('/api/generate-s3-view-url', authenticate, generateS3ViewUrl)
}
