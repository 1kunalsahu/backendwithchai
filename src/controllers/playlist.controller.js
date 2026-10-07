import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {Video} from "../models/video.model.js"
import { User } from "../models/user.model.js";
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
    const {playlistId , videoId} = req.params
    if(!playlistId || !videoId) {
        throw new ApiError(400,'playlist or vdo is missing')
    }
     const checkplaylist=await Playlist.findById(playlistId);
     if(!checkplaylist)
     {
        throw new ApiError(400,"no such playlist exist");
     }
     const video=await Video.findById(videoId);
    if(!video) {
        throw new ApiError(400,"no such vdo exist");
    }
    
    const playlist=await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $addToSet:{
                videos:videoId
            }
        },
        {new:true}
    )

    return res
    .status(200)
    .json(200,playlist,"vdo added to playlist")

})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    const { page = 1, limit = 10 } = req.query;
    //TODO: get user playlists

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    const skip = (pageNumber - 1) * limitNumber;

    const user = await User.findById(userId);
    if(!user){
        throw new ApiError(400,"user not exist")
    }
    const playlist = await Playlist.find(
        {owner:userId}
    )
    .populate("videos")
    .skip(skip)
    .limit(limitNumber)
    .sort({createdAt: -1})
    


    return res.status(200).json(
        new ApiResponse(
            200,
            playlist,
            "User playlists fetched successfully"
        )
    );
})


export {makePlaylist}