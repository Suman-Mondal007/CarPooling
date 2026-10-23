import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { handleSearch, handleReverse, handleRoute } from '../controllers/geo.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/search', handleSearch);
router.get('/reverse', handleReverse);
router.post('/route', handleRoute);

export default router;
