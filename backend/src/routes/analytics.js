import { Router } from 'express';
import { getStore } from '../data/store.js';

const router = Router();

function parseSize(sizeStr) {
  if (!sizeStr) return 0;
  const match = sizeStr.match(/([\d.]+)\s*(MB|octets|bytes)/i);
  if (match) {
    const val = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 'mb') return val * 1024 * 1024;
    return val;
  }
  return 0;
}

router.get('/', (req, res) => {
  const db = getStore();
  let totalFiles = 0;
  let totalSizeBytes = 0;
  const filesByCountry = {};
  let totalSubscriptions = 0;

  for (const weekId of Object.keys(db)) {
    if (weekId === '_countries') continue;

    const weekData = db[weekId];
    if (weekData._subscriptions) {
      totalSubscriptions += weekData._subscriptions.length;
    }

    for (const key of Object.keys(weekData)) {
      if (key === '_subscriptions') continue;
      
      const files = weekData[key];
      if (Array.isArray(files)) {
        totalFiles += files.length;
        filesByCountry[key] = (filesByCountry[key] || 0) + files.length;

        for (const file of files) {
          totalSizeBytes += parseSize(file.size);
        }
      }
    }
  }

  const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2) + ' MB';

  res.json({
    totalFiles,
    totalSize: totalSizeMB,
    totalSizeBytes,
    filesByCountry,
    activeSubscriptions: totalSubscriptions
  });
});

export default router;
