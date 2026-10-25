import express from 'express';
import { getHistory } from '../controllers/history.controller.js';
import authenticate from '../middleware/authenticate.js';
import organizationScope from '../middleware/organizationScope.js';
import validate from '../middleware/validate.js';
import { historyQuerySchema } from '../validators/phase7.validator.js';

const router = express.Router();

router.use(authenticate, organizationScope);

router.get('/', validate(historyQuerySchema), getHistory);

export default router;
