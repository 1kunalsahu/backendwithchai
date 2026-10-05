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
    
    console.log("FILES:", req.files);
const avatarLocalPath = req.files?.avatar[0]?.path;
   const coverImageLocalPath = req.files?.coverImage?.[0]?.path;


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
        secure: true
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
        secure: true
    }

     return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))


})

const refreshAccessToken=asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized request")
    }

    try {
        const decodedToken=jwt.verify(incomingRefreshToken,process.env.ACCESS_TOKEN_SECRET);
            const user = await User.findById(decodedToken?._id)
    
            if(!user) {
                throw new ApiError(401,"invalid refresh token");
    
            }
    
            if(incomingRefreshToken !== user?.refreshToken){
                throw new ApiError(401,"Refresh token is expired or used")
            }
    
            const options ={
                httpOnly:true,
                secure:true
            }
    
            const {accessToken,refreshToken}=await generateAccessAndRefereshTokens(user._id)
    
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
    } catch (error) {
        throw new ApiResponse(401,error?.message || "inavalid refresh token");

    }

})



export {RegisterUser,loginUser,logoutUser,refreshAccessToken};