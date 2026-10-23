import express from 'express';
import { getMyOrganization } from '../controllers/organization.controller.js';
import authenticate from '../middleware/authenticate.js';
import organizationScope from '../middleware/organizationScope.js';

const router = express.Router();

router.use(authenticate, organizationScope);

router.get('/me', getMyOrganization);

export default router;
