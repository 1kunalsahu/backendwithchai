import request from "supertest"
import jwt from "jsonwebtoken"
import {beforeEach, describe, expect, test, vi} from "vitest"

vi.mock("../src/utils/cloudinary.js", () => ({
    uploadOnCloudinary: vi.fn(async (filePath) => filePath ? ({
        url: `https://cloudinary.test/${filePath.split(/[\\/]/).pop()}`,
        duration: 42
    }) : null)
}))

import {app} from "./setup.js"
import {Comment} from "../src/models/comments.model.js"
import {Like} from "../src/models/like.model.js"
import {Playlist} from "../src/models/playlist.model.js"
import {Subscription} from "../src/models/subscription.model.js"
import {Tweet} from "../src/models/tweet.model.js"
import {User} from "../src/models/user.model.js"
import {Video} from "../src/models/video.model.js"
import {uploadOnCloudinary} from "../src/utils/cloudinary.js"
import {
    attachImage, createTestComment, createTestPlaylist, createTestTweet,
    createTestUser, createTestVideo, loginTestUser
} from "./helpers.js"

const validId = "000000000000000000000001"

describe("healthcheck and authentication", () => {
    test("healthcheck returns OK", async () => {
        const response = await request(app).get("/api/v1/healthcheck")
        expect(response.status).toBe(200)
        expect(response.body.data.status).toBe("ok")
    })

    test("registers a user and rejects duplicates", async () => {
        const createRequest = () => request(app)
            .post("/api/v1/users/register")
            .field("fullName", "Registered User")
            .field("email", "registered@example.com")
            .field("username", "registereduser")
            .field("password", "Password123")
            .attach("avatar", Buffer.from("avatar"), "avatar.jpg")

        const first = await createRequest()
        expect(first.status).toBe(201)
        expect(await User.countDocuments({email: "registered@example.com"})).toBe(1)
        expect((await createRequest()).status).toBe(409)
    })

    test("rejects invalid registration and invalid login", async () => {
        const invalidRegistration = await request(app).post("/api/v1/users/register").send({})
        expect(invalidRegistration.status).toBe(400)
        expect(invalidRegistration.body.message).toBe("Please correct the highlighted fields")
        expect(invalidRegistration.body.errors.some((error) => error.path === "username" && error.msg === "Username is required")).toBe(true)
        expect((await request(app).post("/api/v1/users/login").send({
            email: "missing@example.com", password: "wrong"
        })).status).toBe(403)
    })

    test("logs in, gets current user, logs out, and rejects the old session", async () => {
        const {agent, user} = await loginTestUser(app)
        const current = await agent.get("/api/v1/users/currentUser")
        expect(current.status).toBe(200)
        expect(current.body.user.username).toBe(user.username)
        expect((await agent.post("/api/v1/users/logout")).status).toBe(200)
        expect((await agent.get("/api/v1/users/currentUser")).status).toBe(401)
    })

    test("refreshes an access token and rejects an invalid refresh token", async () => {
        const {refreshToken} = await loginTestUser(app)
        expect((await request(app).post("/api/v1/users/refresh-token").send({refreshToken})).status).toBe(200)
        expect((await request(app).post("/api/v1/users/refresh-token")
            .set("Cookie", "refreshToken=invalid-token")
            .send({})).status).toBe(401)
    })

    test("rejects expired refresh tokens and tokens for missing users", async () => {
        const expiredToken = jwt.sign({ _id: validId }, process.env.REFRESH_TOKEN_SECRET, {expiresIn: -1})
        const missingUserToken = jwt.sign({ _id: validId }, process.env.REFRESH_TOKEN_SECRET)
        expect((await request(app).post("/api/v1/users/refresh-token").send({refreshToken: expiredToken})).status).toBe(401)
        expect((await request(app).post("/api/v1/users/refresh-token").send({refreshToken: missingUserToken})).status).toBe(401)
    })

    test("accepts a valid access token in the Authorization header", async () => {
        const {user} = await loginTestUser(app)
        const login = await request(app).post("/api/v1/users/login").send({
            email: user.email, password: "Password123"
        })
        const response = await request(app)
            .get("/api/v1/users/currentUser")
            .set("Authorization", `Bearer ${login.body.data.accessToken}`)
        expect(response.status).toBe(200)
        expect(response.body.user._id).toBe(user._id.toString())
    })

    test("rejects protected APIs without authentication", async () => {
        expect((await request(app).get("/api/v1/dashboard/stats")).status).toBe(401)
    })
})

describe("user APIs", () => {
    test("changes password and rejects the old password", async () => {
        const {agent, user} = await loginTestUser(app)
        const changed = await agent.post("/api/v1/users/change/Password").send({
            oldPassword: "Password123", newPassword: "NewPassword123", confirmPassword: "NewPassword123"
        })
        expect(changed.status).toBe(200)
        expect((await request(app).post("/api/v1/users/login").send({
            email: user.email, password: "Password123"
        })).status).toBe(403)
    })

    test("returns a channel profile and watch history", async () => {
        const {agent, user} = await loginTestUser(app)
        const video = await createTestVideo(user)
        await User.findByIdAndUpdate(user._id, {$push: {watchHistory: video._id}})
        const profile = await agent.get(`/api/v1/users/c/${user.username}`)
        expect(profile.status).toBe(200)
        expect(profile.body.data.username).toBe(user.username)
        const history = await agent.get("/api/v1/users/history")
        expect(history.status).toBe(200)
        expect(history.body.data).toHaveLength(1)
    })

    test("updates avatar and cover image", async () => {
        const {agent, user} = await loginTestUser(app)
        expect((await attachImage(agent, "/api/v1/users/change-avatar")).status).toBe(200)
        expect((await agent.patch("/api/v1/users/cover-Image")
            .attach("coverImage", Buffer.from("cover"), "cover.jpg")).status).toBe(200)
        const updated = await User.findById(user._id)
        expect(updated.avatar).toContain("cloudinary.test")
        expect(updated.coverImage).toContain("cloudinary.test")
    })

    test("returns upload failures for avatar and cover image", async () => {
        const {agent} = await loginTestUser(app)
        uploadOnCloudinary.mockResolvedValueOnce(null)
        expect((await attachImage(agent, "/api/v1/users/change-avatar")).status).toBe(400)
        uploadOnCloudinary.mockResolvedValueOnce(null)
        expect((await agent.patch("/api/v1/users/cover-Image")
            .attach("coverImage", Buffer.from("cover"), "cover.jpg")).status).toBe(400)
    })

    test("rejects invalid password changes and invalid profile IDs", async () => {
        const {agent} = await loginTestUser(app)
        expect((await agent.post("/api/v1/users/change/Password").send({
            oldPassword: "wrong", newPassword: "NewPassword123", confirmPassword: "NewPassword123"
        })).status).toBe(400)
        expect((await agent.get("/api/v1/users/c/not-found-user")).status).toBe(404)
    })
})

describe("video APIs", () => {
    let agent
    let user

    beforeEach(async () => ({agent, user} = await loginTestUser(app)))

    test("publishes a video and validates required files", async () => {
        expect((await agent.post("/api/v1/videos").send({title: "Missing", description: "File"})).status).toBe(400)
        const response = await agent.post("/api/v1/videos")
            .field("title", "Uploaded video")
            .field("description", "Uploaded description")
            .attach("videoFile", Buffer.from("video"), {filename: "video.mp4", contentType: "video/mp4"})
            .attach("thumbnail", Buffer.from("thumbnail"), {filename: "thumbnail.jpg", contentType: "image/jpeg"})
        expect(response.status).toBe(201)
        expect(response.body.data.owner).toBe(user._id.toString())
        expect(await Video.countDocuments({owner: user._id})).toBe(1)
    })

    test("rejects an image uploaded as the video file", async () => {
        const response = await agent.post("/api/v1/videos")
            .field("title", "Invalid video")
            .field("description", "Image uploaded as video")
            .attach("videoFile", Buffer.from("image"), {filename: "photo.jpg", contentType: "image/jpeg"})
            .attach("thumbnail", Buffer.from("thumbnail"), {filename: "thumbnail.jpg", contentType: "image/jpeg"})
        expect(response.status).toBe(400)
        expect(response.body.message).toBe("videoFile must be a video file")
        expect(await Video.countDocuments({owner: user._id})).toBe(0)
    })

    test("returns a client error for an unexpected upload field", async () => {
        const response = await agent.post("/api/v1/videos")
            .attach("wrongField", Buffer.from("video"), {filename: "video.mp4", contentType: "video/mp4"})
        expect(response.status).toBe(400)
        expect(response.body.message).toBe("Unexpected file field")
    })

    test("rejects a video uploaded as the thumbnail", async () => {
        const response = await agent.post("/api/v1/videos")
            .field("title", "Invalid thumbnail")
            .field("description", "Video uploaded as thumbnail")
            .attach("videoFile", Buffer.from("video"), {filename: "video.mp4", contentType: "video/mp4"})
            .attach("thumbnail", Buffer.from("video"), {filename: "thumbnail.mp4", contentType: "video/mp4"})
        expect(response.status).toBe(400)
        expect(response.body.message).toBe("thumbnail must be an image file")
        expect(await Video.countDocuments({owner: user._id})).toBe(0)
    })

    test("returns a Cloudinary failure when video upload fails", async () => {
        uploadOnCloudinary.mockResolvedValueOnce(null)
        const response = await agent.post("/api/v1/videos")
            .field("title", "Failed upload")
            .field("description", "Upload failure")
            .attach("videoFile", Buffer.from("video"), {filename: "video.mp4", contentType: "video/mp4"})
            .attach("thumbnail", Buffer.from("thumbnail"), {filename: "thumbnail.jpg", contentType: "image/jpeg"})
        expect(response.status).toBe(400)
        expect(await Video.countDocuments({owner: user._id})).toBe(0)
    })

    test("lists, searches, paginates, counts one view per user, and records watch history", async () => {
        await createTestVideo(user, {title: "Alpha video", views: 5})
        await createTestVideo(user, {title: "Beta video", views: 10})
        const list = await agent.get("/api/v1/videos?page=1&limit=1&sortBy=views&sortType=desc")
        expect(list.status).toBe(200)
        expect(list.body.data.videos).toHaveLength(1)
        expect(list.body.data.totalVideos).toBe(2)
        expect(list.body.data.totalPages).toBe(2)
        expect(list.body.data.videos[0].title).toBe("Beta video")
        expect((await agent.get("/api/v1/videos?query=Alpha")).body.data.videos).toHaveLength(1)
        const video = await Video.findOne({title: "Alpha video"})
        expect((await agent.get(`/api/v1/videos/${video._id}`)).body.data.views).toBe(6)
        expect((await agent.get(`/api/v1/videos/${video._id}`)).body.data.views).toBe(6)
        const history = await agent.get("/api/v1/users/history")
        expect(history.body.data.map((item) => String(item._id))).toContain(String(video._id))
    })

    test("updates, toggles publish status, and deletes only owned videos", async () => {
        const video = await createTestVideo(user)
        const otherVideo = await createTestVideo(await createTestUser())
        expect((await agent.patch(`/api/v1/videos/${video._id}`).send({title: "Updated title"})).status).toBe(200)
        expect((await agent.patch(`/api/v1/videos/toggle/publish/${video._id}`)).status).toBe(200)
        expect((await Video.findById(video._id)).isPublished).toBe(false)
        expect((await agent.delete(`/api/v1/videos/${video._id}`)).status).toBe(200)
        expect(await Video.exists({_id: video._id})).toBeNull()
        expect((await agent.delete(`/api/v1/videos/${otherVideo._id}`)).status).toBe(404)
    })

    test("rejects invalid video IDs and pagination values", async () => {
        expect((await agent.get("/api/v1/videos/not-an-id")).status).toBe(400)
        expect((await agent.get("/api/v1/videos?page=0&limit=10")).status).toBe(400)
        expect((await agent.get("/api/v1/videos?page=1&limit=101")).status).toBe(400)
    })

    test("returns a Cloudinary failure when updating a thumbnail", async () => {
        const video = await createTestVideo(user)
        uploadOnCloudinary.mockResolvedValueOnce(null)
        const response = await agent.patch(`/api/v1/videos/${video._id}`)
            .attach("thumbnail", Buffer.from("thumbnail"), {filename: "thumbnail.jpg", contentType: "image/jpeg"})
        expect(response.status).toBe(400)
    })
})

describe("playlist APIs", () => {
    test("creates, reads, updates, paginates, and deletes playlists", async () => {
        const {agent, user} = await loginTestUser(app)
        expect((await agent.post("/api/v1/playlist").send({name: "My list", description: "Description"})).status).toBe(200)
        const playlist = await Playlist.findOne({owner: user._id})
        expect((await agent.get(`/api/v1/playlist/${playlist._id}`)).body.data.name).toBe("My list")
        expect((await agent.patch(`/api/v1/playlist/${playlist._id}`).send({name: "Updated list"})).status).toBe(200)
        expect((await agent.get(`/api/v1/playlist/user/${user._id}?page=1&limit=1`)).body.data).toHaveLength(1)
        expect((await agent.delete(`/api/v1/playlist/${playlist._id}`)).status).toBe(200)
        expect(await Playlist.exists({_id: playlist._id})).toBeNull()
    })

    test("adds and removes videos without duplicates", async () => {
        const {agent, user} = await loginTestUser(app)
        const video = await createTestVideo(user)
        const playlist = await createTestPlaylist(user)
        const addRoute = `/api/v1/playlist/add/${video._id}/${playlist._id}`
        expect((await agent.patch(addRoute)).status).toBe(200)
        expect((await agent.patch(addRoute)).status).toBe(200)
        expect((await Playlist.findById(playlist._id)).videos).toHaveLength(1)
        expect((await agent.patch(`/api/v1/playlist/remove/${video._id}/${playlist._id}`)).status).toBe(200)
        expect((await Playlist.findById(playlist._id)).videos).toHaveLength(0)
    })

    test("rejects invalid playlist IDs", async () => {
        const {agent} = await loginTestUser(app)
        expect((await agent.get("/api/v1/playlist/not-an-id")).status).toBe(400)
        expect((await agent.get(`/api/v1/playlist/${validId}`)).status).toBe(404)
        expect((await agent.get(`/api/v1/playlist/user/${validId}`)).status).toBe(400)
    })

    test("prevents another user from changing a playlist", async () => {
        const {agent} = await loginTestUser(app)
        const owner = await createTestUser()
        const playlist = await createTestPlaylist(owner)
        expect((await agent.patch(`/api/v1/playlist/${playlist._id}`).send({name: "Not allowed"})).status).toBe(404)
        expect((await agent.delete(`/api/v1/playlist/${playlist._id}`)).status).toBe(404)
    })

    test("rejects invalid playlist mutations and pagination", async () => {
        const {agent, user} = await loginTestUser(app)
        const playlist = await createTestPlaylist(user)
        expect((await agent.patch(`/api/v1/playlist/${playlist._id}`).send({})).status).toBe(400)
        expect((await agent.patch(`/api/v1/playlist/remove/not-an-id/${playlist._id}`)).status).toBe(400)
        expect((await agent.get(`/api/v1/playlist/user/${user._id}?page=0&limit=1`)).status).toBe(400)
    })
})

describe("comments and likes", () => {
    test("creates, paginates, updates, and deletes comments", async () => {
        const {agent, user} = await loginTestUser(app)
        const video = await createTestVideo(user)
        const created = await agent.post(`/api/v1/comments/${video._id}`).send({content: "First comment"})
        expect(created.status).toBe(201)
        const commentId = created.body.data._id
        expect((await agent.get(`/api/v1/comments/${video._id}?page=1&limit=1`)).body.data.totalComments).toBe(1)
        expect((await agent.patch(`/api/v1/comments/c/${commentId}`).send({content: "Updated comment"})).status).toBe(200)
        expect((await agent.delete(`/api/v1/comments/c/${commentId}`)).status).toBe(200)
        expect(await Comment.exists({_id: commentId})).toBeNull()
    })

    test("rejects invalid comment IDs and comment ownership violations", async () => {
        const {agent, user} = await loginTestUser(app)
        const video = await createTestVideo(user)
        expect((await agent.post("/api/v1/comments/not-an-id").send({content: "bad"})).status).toBe(400)
        const other = await createTestUser()
        const comment = await createTestComment(other, video)
        expect((await agent.patch(`/api/v1/comments/c/${comment._id}`).send({content: "Not allowed"})).status).toBe(404)
        expect((await agent.delete(`/api/v1/comments/c/${comment._id}`)).status).toBe(404)
        expect((await agent.get(`/api/v1/comments/${validId}`)).status).toBe(404)
        expect((await agent.get(`/api/v1/comments/${video._id}?page=0&limit=1`)).status).toBe(200)
    })

    test("toggles video, comment, and tweet likes and persists state", async () => {
        const {agent, user} = await loginTestUser(app)
        const video = await createTestVideo(user)
        const comment = await createTestComment(user, video)
        const tweet = await createTestTweet(user)
        for (const route of [`/api/v1/likes/toggle/v/${video._id}`, `/api/v1/likes/toggle/c/${comment._id}`, `/api/v1/likes/toggle/t/${tweet._id}`]) {
            expect((await agent.post(route)).body.data.liked).toBe(true)
            expect((await agent.post(route)).body.data.liked).toBe(false)
        }
        await agent.post(`/api/v1/likes/toggle/v/${video._id}`)
        expect(await Like.countDocuments({likedBy: user._id, video: video._id})).toBe(1)
        expect((await agent.get("/api/v1/likes/videos")).body.data.videos).toHaveLength(1)
    })

    test("rejects likes for invalid or nonexistent resources", async () => {
        const {agent} = await loginTestUser(app)
        expect((await agent.post("/api/v1/likes/toggle/v/not-an-id")).status).toBe(400)
        expect((await agent.post(`/api/v1/likes/toggle/v/${validId}`)).status).toBe(404)
        expect((await agent.get("/api/v1/likes/videos?page=0&limit=101")).status).toBe(200)
    })
})

describe("tweets, subscriptions, and dashboard", () => {
    test("creates, reads, updates, deletes tweets, and cleans tweet likes", async () => {
        const {agent, user} = await loginTestUser(app)
        const created = await agent.post("/api/v1/tweets").send({content: "Hello"})
        expect(created.status).toBe(201)
        const tweetId = created.body.data._id
        expect((await agent.get(`/api/v1/tweets/user/${user._id}`)).status).toBe(200)
        expect((await agent.patch(`/api/v1/tweets/${tweetId}`).send({content: "Updated"})).status).toBe(200)
        expect((await agent.post(`/api/v1/likes/toggle/t/${tweetId}`)).status).toBe(200)
        expect((await agent.delete(`/api/v1/tweets/${tweetId}`)).status).toBe(200)
        expect(await Tweet.exists({_id: tweetId})).toBeNull()
        expect(await Like.exists({tweet: tweetId})).toBeNull()
    })

    test("rejects invalid tweet resources and ownership violations", async () => {
        const {agent} = await loginTestUser(app)
        const other = await createTestUser()
        const tweet = await createTestTweet(other)
        expect((await agent.get(`/api/v1/tweets/user/${validId}`)).status).toBe(404)
        expect((await agent.patch(`/api/v1/tweets/not-an-id`).send({content: "bad"})).status).toBe(400)
        expect((await agent.patch(`/api/v1/tweets/${tweet._id}`).send({content: "not allowed"})).status).toBe(404)
        expect((await agent.delete(`/api/v1/tweets/${tweet._id}`)).status).toBe(404)
    })

    test("toggles subscriptions and returns both subscription lists", async () => {
        const {agent: subscriber, user: subscriberUser} = await loginTestUser(app)
        const channel = await createTestUser()
        expect((await subscriber.post(`/api/v1/subscriptions/c/${channel._id}`)).status).toBe(201)
        expect(await Subscription.exists({subscriber: subscriberUser._id, channel: channel._id})).not.toBeNull()
        expect((await subscriber.get(`/api/v1/subscriptions/c/${channel._id}`)).status).toBe(200)
        expect((await subscriber.get(`/api/v1/subscriptions/u/${subscriberUser._id}`)).status).toBe(200)
        expect((await subscriber.post(`/api/v1/subscriptions/c/${channel._id}`)).body.data.subscribed).toBe(false)
        expect(await Subscription.exists({subscriber: subscriberUser._id, channel: channel._id})).toBeNull()
    })

    test("rejects self-subscriptions and invalid subscription IDs", async () => {
        const {agent, user} = await loginTestUser(app)
        expect((await agent.post(`/api/v1/subscriptions/c/${user._id}`)).status).toBe(400)
        expect((await agent.get("/api/v1/subscriptions/c/not-an-id")).status).toBe(400)
        expect((await agent.get(`/api/v1/subscriptions/u/${validId}`)).status).toBe(404)
    })

    test("returns channel stats and paginated channel videos", async () => {
        const {agent, user} = await loginTestUser(app)
        await createTestVideo(user, {views: 7})
        await createTestVideo(user, {views: 3})
        const stats = await agent.get("/api/v1/dashboard/stats")
        expect(stats.status).toBe(200)
        expect(stats.body.data.totalVideos).toBe(2)
        expect(stats.body.data.totalViews).toBe(10)
        const videos = await agent.get("/api/v1/dashboard/videos?page=1&limit=1")
        expect(videos.status).toBe(200)
        expect(videos.body.data.videos).toHaveLength(1)
        expect(videos.body.data.totalPages).toBe(2)
    })

    test("returns empty dashboard and liked-video results", async () => {
        const {agent} = await loginTestUser(app)
        const stats = await agent.get("/api/v1/dashboard/stats")
        expect(stats.body.data).toMatchObject({totalVideos: 0, totalViews: 0, totalSubscribers: 0, totalLikes: 0})
        expect((await agent.get("/api/v1/dashboard/videos")).body.data.videos).toHaveLength(0)
        expect((await agent.get("/api/v1/likes/videos")).body.data.videos).toHaveLength(0)
    })

    test("validates dashboard and comment pagination limits", async () => {
        const {agent, user} = await loginTestUser(app)
        const video = await createTestVideo(user)
        expect((await agent.get("/api/v1/dashboard/videos?page=0")).status).toBe(400)
        expect((await agent.get("/api/v1/dashboard/videos?page=1&limit=101")).status).toBe(400)
        expect((await agent.get(`/api/v1/comments/${video._id}?page=1&limit=0`)).status).toBe(200)
    })
})

describe("authentication guard matrix", () => {
    const protectedRoutes = [
        ["POST", "/api/v1/users/logout"],
        ["GET", "/api/v1/users/currentUser"],
        ["POST", "/api/v1/users/change/Password"],
        ["PATCH", "/api/v1/users/change-avatar"],
        ["PATCH", "/api/v1/users/cover-Image"],
        ["GET", "/api/v1/users/c/test-user"],
        ["GET", "/api/v1/users/history"],
        ["POST", "/api/v1/tweets"],
        ["GET", `/api/v1/tweets/user/${validId}`],
        ["PATCH", `/api/v1/tweets/${validId}`],
        ["DELETE", `/api/v1/tweets/${validId}`],
        ["GET", `/api/v1/subscriptions/c/${validId}`],
        ["POST", `/api/v1/subscriptions/c/${validId}`],
        ["GET", `/api/v1/subscriptions/u/${validId}`],
        ["GET", "/api/v1/videos"],
        ["POST", "/api/v1/videos"],
        ["GET", `/api/v1/videos/${validId}`],
        ["PATCH", `/api/v1/videos/${validId}`],
        ["DELETE", `/api/v1/videos/${validId}`],
        ["PATCH", `/api/v1/videos/toggle/publish/${validId}`],
        ["GET", `/api/v1/comments/${validId}`],
        ["POST", `/api/v1/comments/${validId}`],
        ["PATCH", `/api/v1/comments/c/${validId}`],
        ["DELETE", `/api/v1/comments/c/${validId}`],
        ["POST", `/api/v1/likes/toggle/v/${validId}`],
        ["POST", `/api/v1/likes/toggle/c/${validId}`],
        ["POST", `/api/v1/likes/toggle/t/${validId}`],
        ["GET", "/api/v1/likes/videos"],
        ["POST", "/api/v1/playlist"],
        ["GET", `/api/v1/playlist/${validId}`],
        ["PATCH", `/api/v1/playlist/${validId}`],
        ["DELETE", `/api/v1/playlist/${validId}`],
        ["PATCH", `/api/v1/playlist/add/${validId}/${validId}`],
        ["PATCH", `/api/v1/playlist/remove/${validId}/${validId}`],
        ["GET", `/api/v1/playlist/user/${validId}`],
        ["GET", "/api/v1/dashboard/stats"],
        ["GET", "/api/v1/dashboard/videos"]
    ]

    test.each(protectedRoutes)("%s %s rejects unauthenticated requests", async (method, path) => {
        const response = await request(app)[method.toLowerCase()](path)
        expect(response.status).toBe(401)
    })
})
