import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

import dotenv from "dotenv";
dotenv.config();


// console.log("CLOUD NAME:", process.env.CLOUDINARY_CLOUD_NAME);
// console.log("API KEY:", process.env.CLOUDINARY_API_KEY);
// console.log("API SECRET EXISTS:", !!process.env.CLOUDINARY_API_SECRET);
 cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret:process.env.CLOUDINARY_API_SECRET // Click 'View API Keys' above to copy your API secret
    });

const uploadOnCloudinary = async (localFilePath, resourceType = "auto") => {
    try {
        if (!localFilePath) return null;

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: resourceType
        });

        console.log("File uploaded on Cloudinary:", response.url);

        try {
            if (fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath);
            }
        } catch (cleanupError) {
            console.error("Uploaded file cleanup error:", cleanupError.message);
        }

        return response;

    } catch (error) {
        console.error("Cloudinary upload error:", {
            message: error?.message,
            name: error?.name,
            httpCode: error?.http_code,
            resourceType,
        });

        try {
            if (localFilePath && fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath);
            }
        } catch (cleanupError) {
            console.error("Failed to remove local upload after Cloudinary error:", cleanupError.message);
        }

        return null;
    }
};



export {uploadOnCloudinary}
