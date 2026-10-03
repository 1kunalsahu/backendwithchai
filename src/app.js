import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser";


const app=express();
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
})) // kis frontend se allow hoga connect hona
app.use(express.json({limit:"16kb"})) //for taking raw data
app.use(express.urlencoded({extended:true,limit:"16kb"}))//for taking url data

app.use(express.static("public")) // for pdf and all

app.use(cookieParser())


export {app}