import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import bcrypt from 'bcrypt'
import User from '../models/User'

type SessionUser = {
    id: string
    type: 'user'
}

passport.serializeUser((user: any, done) => {
    if (!user?._id) {
        done(new Error('Invalid user for session serialization'))
        return
    }

    const sessionUser: SessionUser = {
        id: String(user._id),
        type: 'user'
    }

    done(null, sessionUser)
})

passport.deserializeUser(async (obj: SessionUser, done) => {
    try {
        if (!obj || obj.type !== 'user' || !obj.id) {
            done(new Error('Unknown user type'))
            return
        }

        const user = await User.findById(obj.id)
        done(null, user ?? false)
    } catch (err) {
        done(err)
    }
})

passport.use(
    'local',
    new LocalStrategy(
        {
            usernameField: 'email',
            passwordField: 'password',
            passReqToCallback: false
        },
        async (email: string, password: string, done) => {
            try {
                const normalizedEmail = String(email ?? '').trim().toLowerCase()
                const user = await User.findOne({ email: normalizedEmail })

                if (!user) {
                    done(null, false)
                    return
                }

                const isMatch = await bcrypt.compare(password, user.password)
                if (!isMatch) {
                    done(null, false)
                    return
                }

                done(null, user)
            } catch (err) {
                console.error('passport local strategy failed', err)
                done(err)
            }
        }
    )
)

export default passport