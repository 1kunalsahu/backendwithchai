import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    if (!isValidObjectId(channelId)) throw new ApiError(400, "Invalid channel id")
    if (String(req.user._id) === String(channelId)) throw new ApiError(400, "You cannot subscribe to yourself")
    if (!(await User.exists({_id: channelId}))) throw new ApiError(404, "Channel not found")
    const existingSubscription = await Subscription.findOne({subscriber: req.user._id, channel: channelId})
    if (existingSubscription) {
        await existingSubscription.deleteOne()
        return res.status(200).json(new ApiResponse(200, {subscribed: false}, "Unsubscribed successfully"))
    }
    await Subscription.create({subscriber: req.user._id, channel: channelId})
    return res.status(201).json(new ApiResponse(201, {subscribed: true}, "Subscribed successfully"))
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const channelId = req.params.channelId || req.params.subscriberId
    if (!isValidObjectId(channelId)) throw new ApiError(400, "Invalid channel id")
    if (!(await User.exists({_id: channelId}))) throw new ApiError(404, "Channel not found")
    const subscribers = await Subscription.find({channel: channelId})
        .populate("subscriber", "username fullName avatar")
        .sort({createdAt: -1})
    return res.status(200).json(new ApiResponse(200, subscribers, "Channel subscribers fetched successfully"))
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const subscriberId = req.params.subscriberId || req.params.channelId
    if (!isValidObjectId(subscriberId)) throw new ApiError(400, "Invalid subscriber id")
    if (!(await User.exists({_id: subscriberId}))) throw new ApiError(404, "User not found")
    const subscriptions = await Subscription.find({subscriber: subscriberId})
        .populate("channel", "username fullName avatar")
        .sort({createdAt: -1})
    return res.status(200).json(new ApiResponse(200, subscriptions, "Subscribed channels fetched successfully"))
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}
