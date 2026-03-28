import { Router } from "express";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "../controllers/platform.controller.js";
import { authenticate, authorizeWebsiteAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", getPlatformSettings);
router.put("/", authenticate, authorizeWebsiteAdmin, updatePlatformSettings);

export default router;
