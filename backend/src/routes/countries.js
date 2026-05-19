import { Router } from 'express';
import { COUNTRIES } from '../data/constants.js';

const router = Router();

router.get('/', (_req, res) => res.json(COUNTRIES));

export default router;
