import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {Like} from "../models/like.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    const content = req.body?.content?.trim()
    if (!content) throw new ApiError(400, "Tweet content is required")
    const tweet = await Tweet.create({content, owner: req.user._id})
    const createdTweet = await Tweet.findById(tweet._id).populate("owner", "username fullName avatar")
    return res.status(201).json(new ApiResponse(201, createdTweet, "Tweet created successfully"))
})

const getUserTweets = asyncHandler(async (req, res) => {
    const {userId} = req.params
    if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid user id")
    if (!(await User.exists({_id: userId}))) throw new ApiError(404, "User not found")
    const tweets = await Tweet.find({owner: userId}).populate("owner", "username fullName avatar").sort({createdAt: -1})
    return res.status(200).json(new ApiResponse(200, tweets, "User tweets fetched successfully"))
})

const updateTweet = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    const content = req.body?.content?.trim()
    if (!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweet id")
    if (!content) throw new ApiError(400, "Tweet content is required")
    const tweet = await Tweet.findOneAndUpdate({_id: tweetId, owner: req.user._id}, {$set: {content}}, {new: true, runValidators: true})
        .populate("owner", "username fullName avatar")
    if (!tweet) throw new ApiError(404, "Tweet not found or you are not the owner")
    return res.status(200).json(new ApiResponse(200, tweet, "Tweet updated successfully"))
})

const deleteTweet = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    if (!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweet id")
    const tweet = await Tweet.findOneAndDelete({_id: tweetId, owner: req.user._id})
    if (!tweet) throw new ApiError(404, "Tweet not found or you are not the owner")
    await Like.deleteMany({tweet: tweetId})
    return res.status(200).json(new ApiResponse(200, tweet, "Tweet deleted successfully"))
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}
