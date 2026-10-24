import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { organizationScope } from '../middleware/organizationScope.js';
import { validate } from '../middleware/validate.js';
import {
  publishRide,
  getMyOfferedRides,
  cancelOfferedRide,
  searchRides,
  getRideById
} from '../controllers/ride.controller.js';
import { publishRideSchema } from '../validators/ride.validator.js';

const router = express.Router();

router.use(authenticate);
router.use(organizationScope);

router.get('/search', searchRides);
router.get('/my-offered', getMyOfferedRides);
router.post('/', validate(publishRideSchema), publishRide);
router.get('/:id', getRideById);
router.post('/:id/cancel', cancelOfferedRide);

export default router;
