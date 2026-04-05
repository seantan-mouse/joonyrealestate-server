import mongoose, { Document, Model, Schema, Types } from 'mongoose'
import bcrypt from 'bcrypt'

export interface UserRole {
    name?: string
    [key: string]: unknown
}

export interface UserAttrs {
    accountId?: Types.ObjectId
    createdAt?: Date
    createdBy?: string
    name?: string
    email: string
    password: string
    role?: UserRole
    remarks?: string
    accessToBuildings?: string[]
    secret?: string
}

export interface UserDoc extends Document {
    accountId?: Types.ObjectId
    createdAt?: Date
    createdBy?: string
    name?: string
    email: string
    password: string
    role?: UserRole
    remarks?: string
    accessToBuildings: string[]
    secret?: string
    comparePassword(candidatePassword: string): Promise<boolean>
}

const userSchema = new Schema<UserDoc>(
    {
        accountId: {
            type: Schema.Types.ObjectId,
            ref: 'Account',
            index: true
        },
        createdAt: Date,
        createdBy: String,
        name: String,
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            index: true,
            unique: true
        },
        password: {
            type: String,
            required: true
        },
        role: {
            type: Schema.Types.Mixed,
            default: {}
        },
        remarks: String,
        accessToBuildings: {
            type: [String],
            default: []
        },
        secret: String
    },
    {
        collection: 'users'
    }
)

userSchema.pre('save', async function (next) {
    const user = this as UserDoc

    if (!user.isModified('password')) {
        next()
        return
    }

    try {
        const salt = await bcrypt.genSalt(10)
        user.password = await bcrypt.hash(user.password, salt)
        next()
    } catch (err) {
        next(err as Error)
    }
})

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password)
}

const UserModel: Model<UserDoc> =
    mongoose.models.User || mongoose.model<UserDoc>('User', userSchema)

export default UserModel
