import { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/authenticate'
import {
    createBuilding,
    deleteBuildingCascade,
    getAllBuildingsSummary,
    getBuildingDetailById,
    getBuildingOccupancyById,
    getBuildingPaymentsOverviewById,
    getBuildingRoomsById,
    getBuildingsForUser,
    updateBuildingById
} from './building.service'

export async function listBuildings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const buildings = await getAllBuildingsSummary(req.account?.id)
        res.json(buildings)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}

export async function listBuildingsForUser(req: AuthenticatedRequest<{ userid: string }>, res: Response): Promise<void> {
    try {
        const buildings = await getBuildingsForUser(req.params.userid, req.account?.id)

        if (!buildings) {
            res.status(404).send('User not found')
            return
        }

        res.json(buildings)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}

export async function createBuildingHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const result = await createBuilding(req.account?.id, req.body)

        if (result.status === 'exists') {
            res.status(409).send('Building name already exists.')
            return
        }

        res.status(201).json(result.building)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}

export async function updateBuildingHandler(req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> {
    try {
        const result = await updateBuildingById(req.params.id, req.account?.id, req.body)

        if (result.status === 'not_found') {
            res.status(404).send('Building not found')
            return
        }

        if (result.status === 'exists') {
            res.status(409).send('Building name already exists.')
            return
        }

        res.json(result.building)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}

export async function getBuildingDetail(req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> {
    try {
        const building = await getBuildingDetailById(req.params.id, req.account?.id)

        if (!building) {
            res.status(404).send('Building not found')
            return
        }

        res.json(building)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}

export async function getBuildingRoomsHandler(req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> {
    try {
        const result = await getBuildingRoomsById(req.params.id, req.account?.id)

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

export async function getBuildingOccupancyHandler(req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> {
    try {
        const result = await getBuildingOccupancyById(req.params.id, req.account?.id)

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

export async function deleteBuildingHandler(req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> {
    try {
        const deleted = await deleteBuildingCascade(req.params.id, req.account?.id)

        if (!deleted) {
            res.status(404).send('Building not found')
            return
        }

        res.sendStatus(200)
    } catch (err) {
        console.error(err)
        res.status(500).send('Internal server error')
    }
}

export async function getBuildingPaymentsOverviewHandler(req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> {
    try {
        const result = await getBuildingPaymentsOverviewById(req.params.id, req.account?.id)

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
