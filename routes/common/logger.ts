export function logRouteError(route: string, err: unknown, context?: Record<string, unknown>) {
    console.error(`[route-error] ${route}`, {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        context: context ?? {}
    })
}