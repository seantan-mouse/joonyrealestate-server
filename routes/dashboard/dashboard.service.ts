import type { DashboardOverviewDto, DashboardOverviewTaskDto } from './dashboard.types'
import { getAllBuildingsSummary } from '../building/building.service'

export async function getDashboardOverview(accountId?: string): Promise<DashboardOverviewDto> {
    const buildings = await getAllBuildingsSummary(accountId)

    let totalRooms = 0
    let occupiedRooms = 0
    let vacantRooms = 0
    let reservedRooms = 0
    let maintenanceRooms = 0

    const tasks: DashboardOverviewTaskDto[] = []

    for (const building of buildings) {
        totalRooms += Number(building.roomCount ?? 0)
        occupiedRooms += Number(building.occupiedRoomCount ?? 0)
        vacantRooms += Number(building.vacantRoomCount ?? 0)
        reservedRooms += Number(building.reservedRoomCount ?? 0)
        maintenanceRooms += Number(building.maintenanceRoomCount ?? 0)

        if ((building.vacantRoomCount ?? 0) > 0) {
            tasks.push({
                buildingName: building.name,
                buildingId: building._id,
                reason: 'Vacant rooms',
                value: Number(building.vacantRoomCount ?? 0),
                color: 'warning'
            })
        }

        if ((building.reservedRoomCount ?? 0) > 0) {
            tasks.push({
                buildingName: building.name,
                buildingId: building._id,
                reason: 'Reserved rooms',
                value: Number(building.reservedRoomCount ?? 0),
                color: 'info'
            })
        }

        if ((building.maintenanceRoomCount ?? 0) > 0) {
            tasks.push({
                buildingName: building.name,
                buildingId: building._id,
                reason: 'Rooms under maintenance',
                value: Number(building.maintenanceRoomCount ?? 0),
                color: 'error'
            })
        }
    }

    const severityRank: Record<DashboardOverviewTaskDto['color'], number> = {
        error: 0,
        warning: 1,
        info: 2,
        success: 3
    }

    tasks.sort((left, right) => {
        const leftRank = severityRank[left.color]
        const rightRank = severityRank[right.color]

        if (leftRank !== rightRank) return leftRank - rightRank
        if (right.value !== left.value) return right.value - left.value
        return left.buildingName.localeCompare(right.buildingName)
    })

    const occupancyRate =
        totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

    return {
        totalRooms,
        occupiedRooms,
        vacantRooms,
        reservedRooms,
        maintenanceRooms,
        occupancyRate,
        tasks
    }
}
