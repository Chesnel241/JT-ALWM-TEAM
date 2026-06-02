import express from 'express';

const router = express.Router();

router.all('*', (req, res) => {
  res.status(404).json({ error: 'R2 presigned URLs are disabled.' });
});

export default router;
