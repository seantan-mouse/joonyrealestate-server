import { Response } from 'express'
import { getBuildingReport } from './report.service'
import Building from '../../models/Building'
import { getUserAccessToBuildings, normalizeUserRoleLower } from '../common/user'
import { getPortfolioBookingPlan, getPortfolioReport } from './portfolio.service'
import type { AuthenticatedRequest } from '../middleware/authenticate'
import type {
    GetBuildingReportInput,
    ReportInvoiceStatusFilter,
    ReportTenantTypeFilter
} from './report.types'
import type {
    GetPortfolioBookingPlanInput,
    GetPortfolioReportInput,
    PortfolioBookingPlanDto,
    PortfolioReportDto
} from './portfolio.types'

function parseCsvParam(value: unknown): string[] {
    return String(value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
}

function parseStatusFilters(value: unknown): ReportInvoiceStatusFilter[] {
    const allowed: ReportInvoiceStatusFilter[] = ['Paid', 'Partial', 'New', 'Overdue']
    return parseCsvParam(value).filter(
        (item): item is ReportInvoiceStatusFilter => allowed.includes(item as ReportInvoiceStatusFilter)
    )
}

function parseTenantTypeFilters(value: unknown): ReportTenantTypeFilter[] {
    const allowed: ReportTenantTypeFilter[] = ['monthly', 'contract']
    return parseCsvParam(value).filter(
        (item): item is ReportTenantTypeFilter => allowed.includes(item as ReportTenantTypeFilter)
    )
}

function parseBooleanParam(value: unknown): boolean {
    const normalized = String(value ?? '').trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

async function resolveAccessibleBuildings(req: AuthenticatedRequest) {
    const normalizedRole = normalizeUserRoleLower(req.user?.role)
    const isAdmin = normalizedRole.includes('admin')
    const accountIds = req.account?.dataAccountIds?.length
        ? req.account.dataAccountIds
        : [String(req.account?.id ?? '').trim()].filter(Boolean)

    if (isAdmin) {
        const buildings = await Building.find({ accountId: { $in: accountIds } })
            .select('_id name')
            .lean<Array<{ _id: unknown; name?: string }>>()

        return buildings
            .map((building) => ({
                _id: String(building._id ?? ''),
                name: String(building.name ?? '')
            }))
            .filter((building) => building._id)
            .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
    }

    const allowedIds = getUserAccessToBuildings(req.user)
    if (allowedIds.length === 0) return []

    const buildings = await Building.find({
        accountId: { $in: accountIds },
        _id: { $in: allowedIds }
    })
        .select('_id name')
        .lean<Array<{ _id: unknown; name?: string }>>()

    return buildings
        .map((building) => ({
            _id: String(building._id ?? ''),
            name: String(building.name ?? '')
        }))
        .filter((building) => building._id)
        .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
}

function resolveScopedBuildingIds(accessibleBuildings: Array<{ _id: string }>, requestedIds: string[]) {
    const accessibleSet = new Set(accessibleBuildings.map((building) => building._id))
    const filteredRequested = requestedIds.filter((id) => accessibleSet.has(id))

    return filteredRequested.length > 0
        ? filteredRequested
        : accessibleBuildings.map((building) => building._id)
}

export async function getBuildingReportHandler(req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> {
    try {
        const start = String(req.query.start ?? '').trim()
        const end = String(req.query.end ?? '').trim()

        if (!start || !end) {
            res.status(400).json({ error: 'start and end are required' })
            return
        }

        const input: GetBuildingReportInput = {
            buildingId: req.params.id,
            start,
            end,
            rooms: parseCsvParam(req.query.rooms),
            statuses: parseStatusFilters(req.query.statuses),
            tenantTypes: parseTenantTypeFilters(req.query.tenantTypes)
        }

        const result = await getBuildingReport(input)

        if (!result) {
            res.status(404).send('Building not found')
            return
        }

        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}

export async function getPortfolioReportHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const start = String(req.query.start ?? '').trim()
        const end = String(req.query.end ?? '').trim()

        if (!start || !end) {
            res.status(400).json({ error: 'start and end are required' })
            return
        }

        const accessibleBuildings = await resolveAccessibleBuildings(req)
        const scopedBuildingIds = resolveScopedBuildingIds(
            accessibleBuildings,
            parseCsvParam(req.query.buildings)
        )

        const input: GetPortfolioReportInput = {
            scopedBuildingIds,
            start,
            end,
            statuses: parseStatusFilters(req.query.statuses),
            tenantTypes: parseTenantTypeFilters(req.query.tenantTypes),
            includeRows: parseBooleanParam(req.query.includeRows)
        }

        const result = await getPortfolioReport(input)

        const payload: PortfolioReportDto = {
            ...result,
            availableBuildings: accessibleBuildings
        }

        res.json(payload)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}

export async function getPortfolioBookingPlanHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const month = String(req.query.month ?? '').trim()
        const start = String(req.query.start ?? '').trim()
        const end = String(req.query.end ?? '').trim()

        if (!month && (!start || !end)) {
            res.status(400).json({ error: 'month or start/end range is required' })
            return
        }

        const accessibleBuildings = await resolveAccessibleBuildings(req)
        const scopedBuildingIds = resolveScopedBuildingIds(
            accessibleBuildings,
            parseCsvParam(req.query.buildings)
        )

        const input: GetPortfolioBookingPlanInput = {
            scopedBuildingIds,
            month: month || undefined,
            start: start || undefined,
            end: end || undefined
        }

        const result = await getPortfolioBookingPlan(input)

        const payload: PortfolioBookingPlanDto = {
            ...result,
            availableBuildings: accessibleBuildings
        }

        res.json(payload)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}
