import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getUploadPresignedUrl } from '../lib/s3.js';
import logger from '../logger/index.js';

const router = express.Router();

// GET /api/presigned/upload?filename=...&contentType=...
router.get('/upload', async (req, res) => {
  try {
    const { filename, contentType } = req.query;

    if (!filename || !contentType) {
      return res.status(400).json({ error: 'filename and contentType are required' });
    }

    // Generate a unique filename to avoid collisions
    const uniqueFilename = `${uuidv4()}-${filename}`;
    const r2Key = `uploads/${uniqueFilename}`;

    // Get the presigned URL valid for 1 hour (3600 seconds)
    const url = await getUploadPresignedUrl(r2Key, contentType, 3600);

    res.json({
      url,
      r2Key,
      filename: uniqueFilename
    });
  } catch (error) {
    logger.error(`Error generating presigned URL: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate presigned URL' });
  }
});

export default router;
