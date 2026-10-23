import express from 'express';
import { getProfile, updateProfile } from '../controllers/user.controller.js';
import authenticate from '../middleware/authenticate.js';
import validate from '../middleware/validate.js';
import { updateProfileSchema } from '../validators/auth.validator.js';

const router = express.Router();

router.use(authenticate);

router.get('/me', getProfile);
router.patch('/me', validate(updateProfileSchema), updateProfile);

export default router;
