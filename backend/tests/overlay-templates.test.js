import { describe, it, expect } from 'vitest';
import { OVERLAY_TEMPLATES, TEXT_ANIMATIONS_IDS, FONT_FAMILIES, generateAssFile } from '../src/data/overlayTemplates.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Tests du registre brand ALWM TV (les anciens templates libass — ticker,
// lower_third, breaking_news — ont été retirés lors du redesign brand
// b06b352). Pipeline libass = legacy ; le rendu master passe par Remotion.

function readAss(overlays, ctx = {}) {
  const wd = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-tpl-'));
  const p = generateAssFile(overlays, wd, ctx);
  const content = fs.readFileSync(p, 'utf8');
  fs.rmSync(wd, { recursive: true, force: true });
  return content;
}

describe('OVERLAY_TEMPLATES (registre brand ALWM)', () => {
  const ids = OVERLAY_TEMPLATES.map((t) => t.id);

  it('expose les 14 modèles brand ALWM (charte officielle)', () => {
    [
      'titre_reportage', 'nom_interview', 'signature_reportage',
      'grand_titre', 'rappel_titres',
      'a_suivre', 'tout_de_suite',
      'publicite', 'compte_a_rebours', 'la_speciale', 'fin_merci',
      'bandeau_infos', 'flash_info', 'alerte_info',
    ].forEach((id) => expect(ids).toContain(id));
  });

  it('chaque template a id + label + fields[] non vides', () => {
    for (const t of OVERLAY_TEMPLATES) {
      expect(typeof t.id).toBe('string');
      expect(typeof t.label).toBe('string');
      expect(t.label.length).toBeGreaterThan(0);
      expect(Array.isArray(t.fields)).toBe(true);
    }
  });

  it('aucun id dupliqué', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('TEXT_ANIMATIONS_IDS', () => {
  it('contient les animations classiques + per-char + Remotion-only', () => {
    [
      'fade', 'scale', 'pop', 'bounce', 'blurin', 'rotate',
      'cascade', 'charpop', 'wave',
      'mask_reveal', 'outline_morph', 'letterspread', 'weight_pulse',
      'kerning_shake', 'glitch_in',
    ].forEach((id) => expect(TEXT_ANIMATIONS_IDS).toContain(id));
  });

  it('aucun id dupliqué', () => {
    expect(new Set(TEXT_ANIMATIONS_IDS).size).toBe(TEXT_ANIMATIONS_IDS.length);
  });
});

describe('FONT_FAMILIES (pack brand + broadcast)', () => {
  it('contient les polices brand officielles', () => {
    // Montserrat Bold/Medium = brand ALWM TV (charte).
    // Inter/Anton/Bebas Neue = polices historiques toujours dispos.
    ['Inter', 'Anton', 'Bebas Neue', 'Archivo Black', 'Barlow', 'Oswald']
      .forEach((f) => expect(FONT_FAMILIES).toContain(f));
  });
});

describe('generateAssFile (libass legacy — pipeline secondaire)', () => {
  // Note : la voie principale est Remotion. libass sert encore pour les
  // sous-titres gravés au cas où.
  it('génère un fichier ASS valide pour des sous-titres', () => {
    const subs = [
      { start: 0.2, end: 1.4, text: 'Bonjour' },
      { start: 1.6, end: 2.8, text: 'Suite' },
    ];
    const wd = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-subs-'));
    const p = generateAssFile([], wd, {}, subs, { position: 'bottom', size: 'M' });
    const content = fs.readFileSync(p, 'utf8');
    fs.rmSync(wd, { recursive: true, force: true });
    expect(content).toContain('[Script Info]');
    expect((content.match(/Dialogue:/g) || []).length).toBe(2);
    expect(content).toContain('\\an2'); // position bas
    expect(content).toContain('Bonjour');
    expect(content).toContain('Suite');
  });

  it('échappe les caractères de contrôle ASS (anti-injection)', () => {
    // Le texte ne doit pas pouvoir contenir d'accolades brutes (override
    // ASS) ni de backslash de contrôle.
    const subs = [{ start: 0, end: 1, text: 'a{b}\\c' }];
    const wd = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-sub-esc-'));
    const p = generateAssFile([], wd, {}, subs, { position: 'top', size: 'S' });
    const content = fs.readFileSync(p, 'utf8');
    fs.rmSync(wd, { recursive: true, force: true });
    expect(content).not.toContain('{b}');
  });

  it('accepte un tableau de subtitles vide sans crasher', () => {
    expect(() => readAss([], {})).not.toThrow();
  });
});
