import { bundle } from '@remotion/bundler';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Produit un site statique servable par le worker Cloud Run (renderMedia).
const out = await bundle({
  entryPoint: path.join(__dirname, '../src/index.js'),
  outDir: path.join(__dirname, '../build'),
});
console.log('Remotion bundle:', out);
