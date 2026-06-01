import { listR2Objects } from './src/lib/s3.js';
import dotenv from 'dotenv';
dotenv.config();

listR2Objects('uploads/').then(files => {
  console.log('Files in R2:', files);
}).catch(console.error);
