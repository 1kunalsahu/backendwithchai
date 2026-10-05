import mongoose,{Schema} from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
const userSchema = new mongoose.Schema({
    username:{
        type:String,
        unique:[true,"this username already exist"],
        required:[true,"required field"],
        lowercase:true,
        trim:true,
        index:true,
        minlength:3,
        match: [/^[a-zA-Z0-9]+$/, "Username can only contain letters and numbers"]
    },
    email:{
        type:String,
        unique:[true,"this email already exist"],
        required:[true,"required field"],
        lowercase:true,
        trim:true,
        index:true,
    },
    fullName:{
        type:String,
        required:[true,"required field"],
        lowercase:true,
        trim:true,

    },
    avatar:{
        type:String,
        required:true

    },
    coverImage:{
        type:String
    },
    password:{
        type:String,
        required:[true,"required field"],
        select:false
    },
    refreshToken:{
        type:String,
        select:false
    },
    watchHistory:[
        {
            type:Schema.Types.ObjectId,
            ref:"Video"
        }
    ]
    
},{timestamps:true})

userSchema.pre("save",async function(){
    if(!this.isModified("password")) return;
    this.password=await bcrypt.hash(this.password,10)
    
})

//custom method
userSchema.methods.isPasswordCorrect=async function(password){
   return await bcrypt.compare(password,this.password)
}

userSchema.methods.generateAccessToken=function(){
    return jwt.sign(
        {
            _id:this._id,
            email:this.email,
            username:this.username,
            fullName:this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken=function(){
     return jwt.sign(
        {
            _id:this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn:process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User=mongoose.model("User",userSchema)