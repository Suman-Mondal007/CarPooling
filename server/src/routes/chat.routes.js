import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { organizationScope } from '../middleware/organizationScope.js';
import { getConversations, getTripMessages } from '../controllers/chat.controller.js';

const router = express.Router();

router.use(authenticate);
router.use(organizationScope);

router.get('/conversations', getConversations);
router.get('/:id/messages', getTripMessages);

export default router;
