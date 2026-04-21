import { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/authenticate'
import { getDashboardOverview } from './dashboard.service'

export async function getDashboardOverviewHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const result = await getDashboardOverview(
            req.account?.dataAccountIds?.length ? req.account.dataAccountIds : req.account?.id
        )
        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}
