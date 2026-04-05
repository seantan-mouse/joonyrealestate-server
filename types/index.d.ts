import 'express-serve-static-core'

declare global {
    namespace Express {
        interface User {
            _id?: string
            id?: string
            email?: string
            name?: string
            role?: string
            password?: string | null
            secret?: string | null
        }

        interface Request {
            user?: User
            logIn(user: User, done: (err?: unknown) => void): void
            logout(done: (err?: unknown) => void): void
            session?: null | Record<string, unknown>
        }
    }
}

export {}