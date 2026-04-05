export type DashboardTaskColor = 'error' | 'warning' | 'info' | 'success'

export type DashboardOverviewTaskDto = {
    buildingName: string
    buildingId: string
    reason: string
    value: number
    color: DashboardTaskColor
}

export type DashboardOverviewDto = {
    totalRooms: number
    occupiedRooms: number
    vacantRooms: number
    reservedRooms: number
    maintenanceRooms: number
    occupancyRate: number
    tasks: DashboardOverviewTaskDto[]
}