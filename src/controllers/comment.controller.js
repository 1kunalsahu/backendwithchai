import mongoose from "mongoose"
import {Comment} from "../models/comments.model.js"
import {Video} from "../models/video.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query
    if (!mongoose.isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id")

    const pageNumber = Math.max(1, Number(page) || 1)
    const limitNumber = Math.min(100, Math.max(1, Number(limit) || 10))
    const video = await Video.exists({_id: videoId})
    if (!video) throw new ApiError(404, "Video not found")

    const [comments, totalComments] = await Promise.all([
        Comment.find({video: videoId})
            .populate("owner", "username fullName avatar")
            .sort({createdAt: -1})
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber),
        Comment.countDocuments({video: videoId})
    ])

    return res.status(200).json(new ApiResponse(200, {
        comments,
        page: pageNumber,
        limit: limitNumber,
        totalComments,
        totalPages: Math.ceil(totalComments / limitNumber)
    }, "Video comments fetched successfully"))
})

const addComment = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    const content = req.body?.content?.trim()
    if (!mongoose.isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id")
    if (!content) throw new ApiError(400, "Comment content is required")
    if (!(await Video.exists({_id: videoId}))) throw new ApiError(404, "Video not found")

    const comment = await Comment.create({content, video: videoId, owner: req.user._id})
    const createdComment = await Comment.findById(comment._id).populate("owner", "username fullName avatar")
    return res.status(201).json(new ApiResponse(201, createdComment, "Comment added successfully"))
})

const updateComment = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    const content = req.body?.content?.trim()
    if (!mongoose.isValidObjectId(commentId)) throw new ApiError(400, "Invalid comment id")
    if (!content) throw new ApiError(400, "Comment content is required")

    const comment = await Comment.findOneAndUpdate(
        {_id: commentId, owner: req.user._id},
        {$set: {content}},
        {returnDocument: "after", runValidators: true}
    ).populate("owner", "username fullName avatar")
    if (!comment) throw new ApiError(404, "Comment not found or you are not the owner")
    return res.status(200).json(new ApiResponse(200, comment, "Comment updated successfully"))
})

const deleteComment = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    if (!mongoose.isValidObjectId(commentId)) throw new ApiError(400, "Invalid comment id")
    const comment = await Comment.findOneAndDelete({_id: commentId, owner: req.user._id})
    if (!comment) throw new ApiError(404, "Comment not found or you are not the owner")
    return res.status(200).json(new ApiResponse(200, comment, "Comment deleted successfully"))
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }
