import {asyncHandler} from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";
import {uploadOnCloudinary} from "../utils/cloudinary.js"




const generateAccessAndRefereshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;

        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };

    } catch (error) {
        console.log("TOKEN ERROR:", error);
        throw new ApiError(
            500,
            error?.message || "Something went wrong while generating tokens"
        );
    }
};

const RegisterUser=asyncHandler(async(req,res)=>{
    //take value from frontend user
    //check all value is valid //done in validate and validator
    //check if user already exist
    //check for images and avatar
    //upload them to claudinnary,avatar
    //create a user in database by createdb
    //remove password and refresh token
    //check for user creation
    //return res

    const {fullName,email,username,password}=req.body
    
    const existedUser = await User.findOne({
        $or:[{username},{email}]
    })

    if(existedUser){
       throw new ApiError(409,"User already existed")
    }
    
    // console.log("FILES:", req.files);
const avatarLocalPath = req.files?.avatar?.[0]?.path;
//    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

   let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400,"avatar file is required")
    }

    //upload to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    //check avatar again because it is required field

    if(!avatar){
        return res.status(400).json("avatar is required")
    }

    const user=await User.create({
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        username:username.toLowerCase(),
        email:email,
        password:password
    })

    
    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!createdUser){
        throw new ApiError(500,"someting wrong while creating registering user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"user registered success")
    )
  
})





const loginUser=asyncHandler( async (req,res)=>{
    //get data from frontend
    //username or email
    //use find function and find that user
    //password check
    //generate token 
    //store is cookies
    
    const {email,username,password}=req.body
    
    if(!username && !email){
        throw new ApiError(400,"username or emmail is required")
    }
    const user = await User.findOne({
    $or: [{ username }, { email }]
}).select("+password");
    
    if(!user){
        throw new ApiError(403,"user not existed")
    }
    
    const isPasswordValid= await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new ApiError(403,"wrong password")
    }
    
    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)
    
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    }
    
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )
})

const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    }

     return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))


})

const refreshAccessToken=asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized request")
    }

    try {
        const decodedToken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
            const user = await User.findById(decodedToken?._id).select("+refreshToken")
    
            if(!user) {
                throw new ApiError(401,"invalid refresh token");
    
            }
    
            if(incomingRefreshToken !== user?.refreshToken){
                throw new ApiError(401,"Refresh token is expired or used")
            }
    
            const options ={
                httpOnly:true,
                secure: process.env.NODE_ENV === "production"
            }
    
            const {accessToken,refreshToken}=await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                "User logged In Successfully"
            )
        )
    } catch (error) {
        throw new ApiResponse(401,error?.message || "inavalid refresh token");

    }

})

const changeCurrentPassword=asyncHandler(async(req,res)=>{
    //use middleware and check token verification
    // take old and new password from frontend
    //match old password with db password 
    //update password field using mongodb method
    //bycrpt password
    const {oldPassword , newPassword, confirmPassword}=req.body
    if(!oldPassword || !newPassword || !confirmPassword) {
        return res.status(400,"enter both oldPassword and new password and confirm")
    }

    if(newPassword !== confirmPassword){
        throw new ApiError(400,"new and confirm pass not matched")
    }
    const user=await User.findById(req.user?._id).select("+password");

    const isPasswordValid=await user.isPasswordCorrect(oldPassword);

    if(!isPasswordValid){
        throw new ApiError(400,"enter valid old password")
    }

    user.password=newPassword

   await user.save({validateBeforeSave:false})

   return res
   .status(200)
   .json(new ApiResponse(200,"password changed"))

})

const getCurrentUser = asyncHandler(async(req,res)=>{
   return res.status(200).json({
        user:req.user,
        message:"current user details"
    }
    )
})


const updateUserAvatar=asyncHandler(async(req,res)=>{
  

    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(403,"avatar is empty")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar){
        throw new ApiError(400,"problem while upload to cloudinary")
    }

   const user= await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}

    )

     return res.status(200).json({
    user,
    message: "Avatar updated successfully"
  });

})

const updateCoverImage=asyncHandler(async(req,res)=>{
  

    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(403,"coverimage is empty")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage){
        throw new ApiError(400,"problem while uploading coverimage to cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {new:true}

    )

     return res.status(200).json({
    user,
    message: "Avatar updated successfully"
  });


})

const getUserChannelProfile=asyncHandler(async(req,res)=>{
        const { username }=req.params

        if(!username?.trim()){
            throw new ApiError(400,"username is missing")
        }

      const channel =  await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
           $lookup:{
            from:"subscriptions",
            localField:"_id",
                foreignField:"subscriber",
            as:"subscribedTo"
           } 
        },
        {
            $addFields:{
                subscribersCount:{
                    $size: "$subscribers"
                },
                
                    subscribedToCount:{
                        $size : "$subscribedTo"
                    },
                isSubscribed:{
                    $cond:{
                        if:{$in:[new mongoose.Types.ObjectId(req.user?._id),"$subscribers.subscriber"]},
                        then: true,
                        else:false
                    }
                }
                
            }
        },
        {
            $project:{
                fullName: 1,
                username:1,
                subscribersCount:1,
                subscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1

            }
        }
        
        ])

    if(!channel?.length){
        throw new ApiError(404,"channel not found")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req,res)=>{
    const user = await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullName:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }

                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "watch history fetched"

        )
    )
})




export {RegisterUser,
    loginUser,
    logoutUser,
    refreshAccessToken
    ,changeCurrentPassword
    ,getCurrentUser
    ,updateUserAvatar,
updateCoverImage,
getUserChannelProfile,
getWatchHistory};
