import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const makePlaylist = asyncHandler(async(req,res)=>{
    const {name , description} =req.body;
    if(!name){
        throw new ApiError(400,"playlist name is required");
    }
    const isExist=await Playlist.findOne({
        owner:req.user._id,
        name:name
    })
    if(isExist){
        throw new ApiError(400,"playlist already exist");
    }

    const playlist=await playlist.create({
        name:name,
        description:description,
        owner:req.user._id
    })

    if(!playlist){
        throw new ApiError(500,"something wrong while creating playlist");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,"playlist added")
    )
    

})

const addVdoToPlaylist = asyncHandler(async(req,res)=>{
    const {video }=req.body;
})


export {makePlaylist}