import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    const pageNumber = Number(page)
    const limitNumber = Number(limit)

    if(!Number.isInteger(pageNumber) || pageNumber < 1){
        throw new ApiError(400,"page must be a positive number")
    }
    if(!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 100){
        throw new ApiError(400,"limit must be between 1 and 100")
    }

    const filter = {
        isPublished:true
    }

    if(query?.trim()){
        filter.$or=[
            {title:{$regex:query.trim(),$options:"i"}},
            {description:{$regex:query.trim(),$options:"i"}}
        ]
    }

    if(userId){
        if(!isValidObjectId(userId)){
            throw new ApiError(400,"invalid user id")
        }
        filter.owner=userId
    }

    const allowedSortFields=["createdAt","views","title"]
    const sortField=allowedSortFields.includes(sortBy) ? sortBy : "createdAt"
    const sortOrder=sortType === "asc" ? 1 : -1
    const skip=(pageNumber-1)*limitNumber

    const [videos,totalVideos]=await Promise.all([
        Video.find(filter)
        .populate("owner","username fullName avatar")
        .sort({[sortField]:sortOrder})
        .skip(skip)
        .limit(limitNumber),
        Video.countDocuments(filter)
    ])

    return res.status(200).json(
        new ApiResponse(200,{
            videos,
            page:pageNumber,
            limit:limitNumber,
            totalVideos,
            totalPages:Math.ceil(totalVideos/limitNumber)
        },"videos fetched successfully")
    )
})

const isMimeType = (file, type) => file?.mimetype?.startsWith(`${type}/`)


const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    if(!title?.trim() || !description?.trim()){
        throw new ApiError(400,"title and description are required")
    }

    const isExist=await Video.findOne({
        owner:req.user._id,
        title:title.trim()
    })

    if(isExist){
        throw new ApiError(400,"this name vdo is already there")
    }

    const uploadedVideoFile = req.files?.videoFile?.[0]
    const thumbnailFile = req.files?.thumbnail?.[0]
    const videoLocalPath=uploadedVideoFile?.path
    const thumbnailLocalPath=thumbnailFile?.path

    if(!videoLocalPath){
        throw new ApiError(400,"video file is required")
    }
    if(!thumbnailLocalPath){
        throw new ApiError(400,"thumbnail file is required")
    }
    if(!isMimeType(uploadedVideoFile, "video")){
        throw new ApiError(400,"videoFile must be a video file")
    }
    if(!isMimeType(thumbnailFile, "image")){
        throw new ApiError(400,"thumbnail must be an image file")
    }

    const videoFile=await uploadOnCloudinary(videoLocalPath, "video")
    if(!videoFile){
        throw new ApiError(400,"video upload failed; use a smaller video or a supported video format")
    }

    const thumbnail=await uploadOnCloudinary(thumbnailLocalPath, "image")
    if(!thumbnail){
        throw new ApiError(400,"thumbnail upload failed; use a supported image format")
    }

    const video=await Video.create({
        videoFile:videoFile?.url,
        thumbnail:thumbnail?.url,
        title:title.trim(),
        description:description.trim(),
        duration:videoFile?.duration || 0,
        owner:req.user._id
    })

    if(!video){
        throw new ApiError(500,"something wrong while publishing video")
    }

    return res.status(201).json(
        new ApiResponse(201,video,"video published successfully")
    )
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"invalid video id")
    }

    let video=await Video.findOneAndUpdate(
        {_id: videoId, viewedBy: {$ne: req.user._id}},
        {
            $inc:{views:1},
            $addToSet:{viewedBy: req.user._id}
        },
        {returnDocument: "after"}
    ).populate("owner","username fullName avatar")

    if (!video) {
        video = await Video.findById(videoId).populate("owner","username fullName avatar")
    }

    if(!video){
        throw new ApiError(404,"video not found")
    }

    await User.updateOne(
        {_id: req.user._id},
        {$addToSet: {watchHistory: video._id}}
    )

    return res.status(200).json(
        new ApiResponse(200,video,"video fetched successfully")
    )
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const {title,description}=req.body

    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"invalid video id")
    }
    if(!title?.trim() && !description?.trim() && !req.file?.path){
        throw new ApiError(400,"title, description or thumbnail is required")
    }
    if(req.file && !isMimeType(req.file, "image")){
        throw new ApiError(400,"thumbnail must be an image file")
    }

    const updateData={}
    if(title?.trim()) updateData.title=title.trim()
    if(description?.trim()) updateData.description=description.trim()

    if(req.file?.path){
        const thumbnail=await uploadOnCloudinary(req.file.path, "image")
        if(!thumbnail){
            throw new ApiError(400,"problem while uploading thumbnail")
        }
        updateData.thumbnail=thumbnail.url
    }

    const video=await Video.findOneAndUpdate(
        {
            _id:videoId,
            owner:req.user._id
        },
        {
            $set:updateData
        },
        {
            returnDocument: "after",
            runValidators:true
        }
    ).populate("owner","username fullName avatar")

    if(!video){
        throw new ApiError(404,"video not found or you are not the owner")
    }

    return res.status(200).json(
        new ApiResponse(200,video,"video updated successfully")
    )

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"invalid video id")
    }

    const video=await Video.findOneAndDelete({
        _id:videoId,
        owner:req.user._id
    })

    if(!video){
        throw new ApiError(404,"video not found or you are not the owner")
    }

    return res.status(200).json(
        new ApiResponse(200,video,"video deleted successfully")
    )
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"invalid video id")
    }

    const video=await Video.findOne({
        _id:videoId,
        owner:req.user._id
    })

    if(!video){
        throw new ApiError(404,"video not found or you are not the owner")
    }

    video.isPublished=!video.isPublished
    await video.save({validateBeforeSave:false})

    return res.status(200).json(
        new ApiResponse(200,video,"video publish status changed successfully")
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
