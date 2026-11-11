import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import logger from '../logger/index.js';
import { requireAdmin } from '../middleware/auth.js';
import { validateMagicNumber } from '../middleware/fileValidator.js';
import { nomLisible } from '../middleware/sanitizer.js';
import { uploadsDir, VIDEO_EXTENSIONS, extensionEffective } from '../lib/upload.js';
import { mesurerDuree } from '../services/mediaDuration.js';
import { CATEGORIES_JINGLES, getJingles, addJingle, deleteJingle, setJingleDuration } from '../data/store.js';
import { io } from '../app.js';

/**
 * Les jingles du JT : générique, virgule des reportages, des annonces, des
 * séminaires, du Mot du JT.
 *
 * LE BESOIN : ces vidéos sont montées à part, une fois, et resservent chaque
 * semaine. Déposées comme des rushes, elles disparaissaient avec leur
 * semaine, et il fallait les renvoyer à chaque JT. Ici elles sont rangées
 * par catégorie et gardées jusqu'à suppression manuelle.
 *
 * Tout est réservé à l'équipe montage. Le fichier est écrit dans le dossier
 * des rushes : le studio et le moteur de rendu le lisent comme un rush.
 */
const router = Router();
const TAILLE_MAX = parseInt(process.env.JINGLE_MAX_SIZE || 2 * 1024 * 1024 * 1024, 10); // 2 Go
const PAR_CATEGORIE_MAX = 20;

const televersement = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `jingle-${uuidv4()}${extensionEffective(file.originalname, file.mimetype)}`),
  }),
  limits: { fileSize: TAILLE_MAX, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = extensionEffective(file.originalname, file.mimetype);
    if (!VIDEO_EXTENSIONS.includes(ext)) return cb(Object.assign(new Error('Un jingle est une vidéo (MP4, MOV…).'), { status: 400 }));
    return cb(null, true);
  },
}).single('file');

const effacer = (chemin) => { try { if (fs.existsSync(chemin)) fs.unlinkSync(chemin); } catch { /* déjà parti */ } };

router.get('/', requireAdmin, (req, res) => {
  res.json({ categories: CATEGORIES_JINGLES, jingles: getJingles() });
});

router.post('/', requireAdmin, (req, res) => {
  televersement(req, res, async (err) => {
    const fichier = req.file;
    if (err) {
      if (fichier) effacer(fichier.path);
      const tropGros = err.code === 'LIMIT_FILE_SIZE';
      return res.status(tropGros ? 413 : (err.status || 400)).json({
        message: tropGros ? 'Ce fichier est trop lourd pour un jingle (2 Go au plus).' : err.message,
      });
    }
    if (!fichier) return res.status(400).json({ message: 'Aucun fichier reçu.' });
    const categorie = String(req.body?.categorie || '');
    if (!CATEGORIES_JINGLES.includes(categorie)) {
      effacer(fichier.path);
      return res.status(400).json({ message: 'Catégorie de jingle inconnue.' });
    }
    if (getJingles().filter((j) => j.categorie === categorie).length >= PAR_CATEGORIE_MAX) {
      effacer(fichier.path);
      return res.status(400).json({ message: `Cette catégorie contient déjà ${PAR_CATEGORIE_MAX} jingles. Supprimez-en un avant d’en ajouter.` });
    }
    const ext = path.extname(fichier.filename).toLowerCase();
    if (!validateMagicNumber(fichier.path, ext).valid) {
      effacer(fichier.path);
      return res.status(400).json({ message: 'Ce fichier n’est pas une vidéo lisible.' });
    }
    const nomSaisi = String(req.body?.nom || '').trim().slice(0, 80);
    const jingle = addJingle({
      id: uuidv4(),
      categorie,
      name: nomSaisi || nomLisible(fichier.originalname).replace(/\.[^.]+$/, '').slice(0, 80) || 'Jingle',
      filename: fichier.filename,
      type: 'video',
      taille: fichier.size,
      durationSec: null,
      uploadedAt: new Date().toISOString(),
    });
    logger.info('Jingle ajouté', { context: { categorie, fichier: fichier.filename, octets: fichier.size } });
    io?.emit('jingles_update');
    res.status(201).json({ jingle });
    // La durée, mesurée après la réponse : elle ne fait pas attendre l'envoi.
    mesurerDuree(fichier.path).then((duree) => {
      if (duree && setJingleDuration(jingle.id, duree)) io?.emit('jingles_update');
    }).catch(() => {});
    return undefined;
  });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const retire = deleteJingle(String(req.params.id));
  if (!retire) return res.status(404).json({ message: 'Ce jingle n’existe plus.' });
  // Le nom vient du carnet, jamais de la requête : rien à nettoyer ici.
  effacer(path.join(uploadsDir, path.basename(retire.filename)));
  logger.info('Jingle supprimé', { context: { categorie: retire.categorie, fichier: retire.filename } });
  io?.emit('jingles_update');
  return res.json({ ok: true });
});

export default router;
