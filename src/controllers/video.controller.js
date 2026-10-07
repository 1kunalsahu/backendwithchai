import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {Video} from "../models/video.model.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async(req,res)=>{
    const {page =1,limit=10,query,sortBy,sortType,userId}=req.query

    

})

const publishVideoById = asyncHandler(async(req,res)=>{
    const {title,description} = req.body

    if(!title || !description){
        throw new ApiError(400,"title aur description to daal lo");
    }
    const isExist=await Video.findOne({
            owner:req.user._id,
            title:title
        })

    if(isExist){
        throw new ApiError(400,"this name vdo is already there");
    }
    const VideolocalPath = req.files?.video[0]?.path
    const thumbnailLocalPath=req.files?.thumbnail[0]?.path

    if(!VideolocalPath) {
        throw new ApiError(403,"video file is missing")
    }
    if(!thumbnailLocalPath) {
        throw new ApiError(403,"thumbnail file is missing")
    }
   const vdo=await uploadOnCloudinary(VideolocalPath);
    const thumbnail=await uploadOnCloudinary(thumbnailLocalPath);

    if(!vdo || !thumbnail){
        throw new ApiError(400,"something wrong while uploding vdo/thumbnail to cloudinary");
    }

    const video = await Video.create({
           videoFile:vdo?.url,
           thumbnail:thumbnail?.url,
            title,
            description
    })

    return res
    .status(200)
    .json(
        new ApiResponse(200,video,"video published successfully")
    )
    

})
