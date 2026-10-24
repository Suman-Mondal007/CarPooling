import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { organizationScope } from '../middleware/organizationScope.js';
import { validate } from '../middleware/validate.js';
import {
  createBooking,
  createSeriesBooking,
  cancelBooking,
  getMyBookings,
  getBookingById
} from '../controllers/booking.controller.js';
import {
  createBookingSchema,
  seriesBookingSchema
} from '../validators/booking.validator.js';

const router = express.Router();

router.use(authenticate);
router.use(organizationScope);

router.post('/', validate(createBookingSchema), createBooking);
router.post('/series', validate(seriesBookingSchema), createSeriesBooking);
router.get('/my', getMyBookings);
router.get('/:id', getBookingById);
router.post('/:id/cancel', cancelBooking);

export default router;
