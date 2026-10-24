import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { organizationScope } from '../middleware/organizationScope.js';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../controllers/notification.controller.js';

const router = express.Router();

router.use(authenticate);
router.use(organizationScope);

router.get('/', getNotifications);
router.patch('/:id/read', markNotificationAsRead);
router.post('/read-all', markAllNotificationsAsRead);

export default router;
