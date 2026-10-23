import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { organizationScope } from '../middleware/organizationScope.js';
import { validate } from '../middleware/validate.js';
import {
  getSavedPlaces,
  getSavedPlaceById,
  createSavedPlace,
  updateSavedPlace,
  deleteSavedPlace
} from '../controllers/savedPlace.controller.js';
import {
  createSavedPlaceSchema,
  updateSavedPlaceSchema
} from '../validators/savedPlace.validator.js';

const router = express.Router();

router.use(authenticate);
router.use(organizationScope);

router.get('/', getSavedPlaces);
router.post('/', validate(createSavedPlaceSchema), createSavedPlace);
router.get('/:id', getSavedPlaceById);
router.patch('/:id', validate(updateSavedPlaceSchema), updateSavedPlace);
router.delete('/:id', deleteSavedPlace);

export default router;
