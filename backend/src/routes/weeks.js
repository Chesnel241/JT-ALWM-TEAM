import { Router } from 'express';
import { WEEKS } from '../data/constants.js';

const router = Router();

router.get('/', (_req, res) => res.json(WEEKS));

export default router;
