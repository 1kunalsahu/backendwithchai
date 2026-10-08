import mongoose from "mongoose"
import {unlink} from "node:fs/promises"
import {MongoMemoryServer} from "mongodb-memory-server"
import {beforeAll, afterAll, afterEach} from "vitest"
import {app} from "../src/app.js"
import {User} from "../src/models/user.model.js"
import {Video} from "../src/models/video.model.js"
import {Playlist} from "../src/models/playlist.model.js"
import {Comment} from "../src/models/comments.model.js"
import {Like} from "../src/models/like.model.js"
import {Tweet} from "../src/models/tweet.model.js"
import {Subscription} from "../src/models/subscription.model.js"

let mongoServer

beforeAll(async () => {
    process.env.NODE_ENV = "test"
    process.env.ACCESS_TOKEN_SECRET = "test-access-secret"
    process.env.ACCESS_TOKEN_EXPIRY = "1h"
    process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret"
    process.env.REFRESH_TOKEN_EXPIRY = "7d"
    process.env.CORS_ORIGIN = "http://localhost:3000"

    mongoServer = await MongoMemoryServer.create()
    await mongoose.connect(mongoServer.getUri())
})

afterEach(async () => {
    await Promise.all([
        User.deleteMany({}), Video.deleteMany({}), Playlist.deleteMany({}),
        Comment.deleteMany({}), Like.deleteMany({}), Tweet.deleteMany({}),
        Subscription.deleteMany({})
    ])
})

afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
    await Promise.all(["avatar.jpg", "cover.jpg", "thumbnail.jpg", "video.mp4"].map((file) =>
        unlink(`public/temp/${file}`).catch(() => {})
    ))
})

export {app}
