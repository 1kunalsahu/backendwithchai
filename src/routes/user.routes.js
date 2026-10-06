import { Router } from "express";
import { RegisterUser,loginUser,refreshAccessToken,
    logoutUser,
    getCurrentUser,
    changeCurrentPassword,
    updateCoverImage,
    updateUserAvatar,
    getUserChannelProfile,
getWatchHistory

 } from "../controllers/user.controller.js";
import { upload } from "../middleware/multer.middleware.js";
import { registerValidator } from "../validators/user.validator.js";
import { validate } from "../middleware/validate.middleware.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();


router.route("/register").post(
    upload.fields([
{
    name:"avatar",
    maxCount:1
},
{
    name:"coverImage",
    maxCount:1
}
    ]),
    registerValidator,
    validate,
    RegisterUser)

router.route("/login").post(
    loginUser
)
router.route("/logout").post(
    verifyJWT,
logoutUser
)
router.route("/refresh-token").post(refreshAccessToken)

router.route("/currentUser").get(verifyJWT,getCurrentUser)
router.route("/change/Password").post(verifyJWT,changeCurrentPassword)
router.route("/change-avatar").patch(verifyJWT,
    upload.single(
"avatar"),

updateUserAvatar
)
router.route("/cover-Image").patch(verifyJWT,
    upload.single(
"coverImage"),
updateCoverImage
)

// taking data from params
router.route("/c/:username").get(verifyJWT,getUserChannelProfile)
router.route("/history").get(verifyJWT,getWatchHistory)


export default router