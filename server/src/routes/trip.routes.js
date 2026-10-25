import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { organizationScope } from '../middleware/organizationScope.js';
import {
  getMyTrips,
  getTripById,
  startTrip,
  completeTrip,
  getTripTracking
} from '../controllers/trip.controller.js';
import { getTripMessages } from '../controllers/chat.controller.js';

const router = express.Router();

router.use(authenticate);
router.use(organizationScope);

router.get('/my', getMyTrips);
router.get('/:id', getTripById);
router.get('/:id/tracking', getTripTracking);
router.get('/:id/messages', getTripMessages);
router.post('/:id/start', startTrip);
router.post('/:id/complete', completeTrip);

export default router;
