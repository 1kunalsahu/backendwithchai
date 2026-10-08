import request from "supertest"
import {expect} from "vitest"
import {User} from "../src/models/user.model.js"
import {Video} from "../src/models/video.model.js"
import {Playlist} from "../src/models/playlist.model.js"
import {Comment} from "../src/models/comments.model.js"
import {Tweet} from "../src/models/tweet.model.js"

let userNumber = 0

const createTestUser = async (overrides = {}) => {
    userNumber += 1
    return User.create({
        fullName: `Test User ${userNumber}`,
        username: `testuser${userNumber}`,
        email: `testuser${userNumber}@example.com`,
        password: "Password123",
        avatar: "https://example.com/avatar.jpg",
        coverImage: "",
        ...overrides
    })
}

const loginTestUser = async (app, user = {}) => {
    const createdUser = user._id ? user : await createTestUser(user)
    const agent = request.agent(app)
    const response = await agent.post("/api/v1/users/login").send({
        email: createdUser.email,
        password: "Password123"
    })
    expect(response.status).toBe(200)
    return {agent, user: createdUser, refreshToken: response.body.data.refreshToken}
}

const createTestVideo = (owner, overrides = {}) => Video.create({
    videoFile: "https://example.com/video.mp4",
    thumbnail: "https://example.com/thumbnail.jpg",
    title: `Test video ${Date.now()}-${Math.random()}`,
    description: "A test video",
    duration: 10,
    owner: owner._id,
    ...overrides
})

const createTestPlaylist = (owner, overrides = {}) => Playlist.create({
    name: `Test playlist ${Date.now()}-${Math.random()}`,
    description: "A test playlist",
    owner: owner._id,
    ...overrides
})

const createTestComment = (owner, video, overrides = {}) => Comment.create({
    content: "A test comment", owner: owner._id, video: video._id, ...overrides
})

const createTestTweet = (owner, overrides = {}) => Tweet.create({
    content: "A test tweet", owner: owner._id, ...overrides
})

const attachImage = (agent, route, field = "avatar") => agent
    .patch(route)
    .attach(field, Buffer.from("test image"), `${field}.jpg`)

export {
    attachImage, createTestComment, createTestPlaylist, createTestTweet,
    createTestUser, createTestVideo, loginTestUser
}
