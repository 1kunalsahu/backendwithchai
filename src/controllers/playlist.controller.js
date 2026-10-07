import mongoose from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {Video} from "../models/video.model.js"
import { User } from "../models/user.model.js";
const createPlaylist = asyncHandler(async(req,res)=>{
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

    const playlist=await Playlist.create({
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

const addVideoToPlaylist = asyncHandler(async(req,res)=>{
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
    .json(new ApiResponse(200,playlist,"vdo added to playlist"))

})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    const { page = 1, limit = 10 } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if(!mongoose.isValidObjectId(userId)){
        throw new ApiError(400,"invalid user id")
    }
    if(!Number.isInteger(pageNumber) || pageNumber < 1){
        throw new ApiError(400,"page must be a positive number")
    }
    if(!Number.isInteger(limitNumber) || limitNumber < 1){
        throw new ApiError(400,"limit must be a positive number")
    }

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

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    if(!mongoose.isValidObjectId(playlistId)){
        throw new ApiError(400,"invalid playlist id")
    }

    const playlist=await Playlist.findById(playlistId)
    .populate("videos")
    .populate("owner","username fullName avatar")

    if(!playlist){
        throw new ApiError(404,"playlist not found")
    }

    return res.status(200).json(
        new ApiResponse(200,playlist,"playlist fetched successfully")
    )
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    if(!mongoose.isValidObjectId(playlistId)){
        throw new ApiError(400,"invalid playlist id")
    }

    const playlist=await Playlist.findOneAndDelete({
        _id:playlistId,
        owner:req.user._id
    })

    if(!playlist){
        throw new ApiError(404,"playlist not found or you are not the owner")
    }

    return res.status(200).json(
        new ApiResponse(200,playlist,"playlist deleted successfully")
    )
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    if(!mongoose.isValidObjectId(playlistId)){
        throw new ApiError(400,"invalid playlist id")
    }
    if(!name && !description){
        throw new ApiError(400,"name or description is required")
    }

    const updateData={}
    if(name?.trim()) updateData.name=name.trim()
    if(description?.trim()) updateData.description=description.trim()

    const playlist=await Playlist.findOneAndUpdate(
        {
            _id:playlistId,
            owner:req.user._id
        },
        {
            $set:updateData
        },
        {
            new:true,
            runValidators:true
        }
    ).populate("videos")

    if(!playlist){
        throw new ApiError(404,"playlist not found or you are not the owner")
    }

    return res.status(200).json(
        new ApiResponse(200,playlist,"playlist updated successfully")
    )
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    if(!mongoose.isValidObjectId(playlistId) || !mongoose.isValidObjectId(videoId)){
        throw new ApiError(400,"invalid playlist or video id")
    }

    const playlist=await Playlist.findOneAndUpdate(
        {
            _id:playlistId,
            owner:req.user._id
        },
        {
            $pull:{
                videos:videoId
            }
        },
        {new:true}
    ).populate("videos")

    if(!playlist){
        throw new ApiError(404,"playlist not found or you are not the owner")
    }

    return res.status(200).json(
        new ApiResponse(200,playlist,"video removed from playlist")
    )

})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}
