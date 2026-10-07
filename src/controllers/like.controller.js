import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {Video} from "../models/video.model.js"
import {Comment} from "../models/comments.model.js"
import {Tweet} from "../models/tweet.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id")

    if (!(await Video.exists({_id: videoId}))) throw new ApiError(404, "Video not found")
        
    const existingLike = await Like.findOne({video: videoId, likedBy: req.user._id})
    
    if (existingLike) {
        await existingLike.deleteOne()
        return res.status(200).json(new ApiResponse(200, {liked: false}, "Video unliked successfully"))
    }
    await Like.create({video: videoId, likedBy: req.user._id})
    return res.status(200).json(new ApiResponse(200, {liked: true}, "Video liked successfully"))
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    if (!isValidObjectId(commentId)) throw new ApiError(400, "Invalid comment id")
    if (!(await Comment.exists({_id: commentId}))) throw new ApiError(404, "Comment not found")
    const existingLike = await Like.findOne({comment: commentId, likedBy: req.user._id})
    if (existingLike) {
        await existingLike.deleteOne()
        return res.status(200).json(new ApiResponse(200, {liked: false}, "Comment unliked successfully"))
    }
    await Like.create({comment: commentId, likedBy: req.user._id})
    return res.status(200).json(new ApiResponse(200, {liked: true}, "Comment liked successfully"))

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    if (!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweet id")
    if (!(await Tweet.exists({_id: tweetId}))) throw new ApiError(404, "Tweet not found")
    const existingLike = await Like.findOne({tweet: tweetId, likedBy: req.user._id})
    if (existingLike) {
        await existingLike.deleteOne()
        return res.status(200).json(new ApiResponse(200, {liked: false}, "Tweet unliked successfully"))
    }
    await Like.create({tweet: tweetId, likedBy: req.user._id})
    return res.status(200).json(new ApiResponse(200, {liked: true}, "Tweet liked successfully"))
}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    const {page = 1, limit = 10} = req.query
    const pageNumber = Math.max(1, Number(page) || 1)
    const limitNumber = Math.min(100, Math.max(1, Number(limit) || 10))
    const filter = {likedBy: req.user._id, video: {$exists: true}}
    const [likes, total] = await Promise.all([
        Like.find(filter).populate({path: "video", populate: {path: "owner", select: "username fullName avatar"}})
            .sort({createdAt: -1}).skip((pageNumber - 1) * limitNumber).limit(limitNumber),
        Like.countDocuments(filter)
    ])
    return res.status(200).json(new ApiResponse(200, {
        videos: likes.map((like) => like.video).filter(Boolean), page: pageNumber,
        limit: limitNumber, total, totalPages: Math.ceil(total / limitNumber)
    }, "Liked videos fetched successfully"))
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}
