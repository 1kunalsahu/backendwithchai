import { Router } from "express";
import { RegisterUser,loginUser,refreshAccessToken,logoutUser } from "../controllers/user.controller.js";
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


export default router