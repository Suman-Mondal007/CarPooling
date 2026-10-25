import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { organizationScope } from '../middleware/organizationScope.js';
import { simulateLocation } from '../controllers/dev.controller.js';

const router = express.Router();

router.use(authenticate);
router.use(organizationScope);

router.post('/trips/:id/simulate-location', simulateLocation);

export default router;
