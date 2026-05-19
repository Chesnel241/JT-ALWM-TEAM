import express from 'express';
import cors from 'cors';
import { mkdirSync } from 'fs';
import { join } from 'path';
import countriesRouter from './routes/countries.js';
import weeksRouter from './routes/weeks.js';
import uploadsRouter from './routes/uploads.js';
import { WEEKS } from './data/constants.js';
import { cleanupExpiredUploads } from './data/store.js';

// Creer le dossier uploads s'il n'existe pas
const uploadsDir = join(process.cwd(), 'uploads');
mkdirSync(uploadsDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/countries', countriesRouter);
app.use('/api/weeks', weeksRouter);
app.use('/api/uploads', uploadsRouter);

// Nettoyage periodique des uploads (48h apres fin de semaine archivee)
cleanupExpiredUploads(WEEKS, uploadsDir);
setInterval(() => cleanupExpiredUploads(WEEKS, uploadsDir), 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`✅ Backend JT ALWM démarré sur http://localhost:${PORT}`);
});
