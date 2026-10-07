import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getAuthenticatedUserId = (req) => {
    const userId = req.user?._id
    if (!userId || !mongoose.isValidObjectId(userId)) {
        throw new ApiError(401, "Unauthorized request")
    }
    return userId
}

const getChannelStats = asyncHandler(async (req, res) => {
    const ownerId = getAuthenticatedUserId(req)
    const [videoStats, totalSubscribers, videos] = await Promise.all([
        Video.aggregate([
            {$match: {owner: ownerId}},
            {$group: {_id: null, totalVideos: {$sum: 1}, totalViews: {$sum: "$views"}}}
        ]),
        Subscription.countDocuments({channel: ownerId}),
        Video.find({owner: ownerId}).select("_id")
    ])
    const totalLikes = videos.length
        ? await Like.countDocuments({video: {$in: videos.map((video) => video._id)}})
        : 0
    const stats = videoStats[0] || {totalVideos: 0, totalViews: 0}
    return res.status(200).json(new ApiResponse(200, {
        totalVideos: stats.totalVideos,
        totalViews: stats.totalViews,
        totalSubscribers,
        totalLikes
    }, "Channel stats fetched successfully"))
})

const getChannelVideos = asyncHandler(async (req, res) => {
    const ownerId = getAuthenticatedUserId(req)
    const {page = 1, limit = 10} = req.query
    const pageNumber = Number(page)
    const limitNumber = Number(limit)
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
        throw new ApiError(400, "Page must be a positive integer")
    }
    if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) {
        throw new ApiError(400, "Limit must be an integer between 1 and 100")
    }
    const filter = {owner: ownerId}
    const [videos, totalVideos] = await Promise.all([
        Video.find(filter).populate("owner", "username fullName avatar")
            .sort({createdAt: -1}).skip((pageNumber - 1) * limitNumber).limit(limitNumber),
        Video.countDocuments(filter)
    ])
    return res.status(200).json(new ApiResponse(200, {
        videos, page: pageNumber, limit: limitNumber, totalVideos,
        totalPages: Math.ceil(totalVideos / limitNumber)
    }, "Channel videos fetched successfully"))
})

export {
    getChannelStats, 
    getChannelVideos
    }
