import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { organizationScope } from '../middleware/organizationScope.js';
import { validate } from '../middleware/validate.js';
import {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle
} from '../controllers/vehicle.controller.js';
import { createVehicleSchema, updateVehicleSchema } from '../validators/vehicle.validator.js';

const router = express.Router();

router.use(authenticate);
router.use(organizationScope);

router.get('/', getVehicles);
router.post('/', validate(createVehicleSchema), createVehicle);
router.get('/:id', getVehicleById);
router.patch('/:id', validate(updateVehicleSchema), updateVehicle);
router.delete('/:id', deleteVehicle);

export default router;
