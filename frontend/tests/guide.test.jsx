import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { translations } from '../src/i18n/translations.js';
import { getTourSteps } from '../src/data/tourSteps.js';
import { getAIResponse } from '../src/data/faqKnowledge.js';
import GuideView, { ETAPES_GUIDE } from '../src/components/GuideView.jsx';
import { parsePath, buildPath, WORKSPACES } from '../src/lib/routing.js';

// L'INCIDENT : la visite guidée pointait trois éléments qui n'existaient plus
// (`#tour-nav-editing`, `#tour-delivery-dropzone`, `#tour-voixoff-country`) et
// décrivait des écrans d'avant les refontes ; l'aide se présentait comme une
// « intelligence artificielle » alors qu'elle répond par mots-clés.
// LE BESOIN : un guide qui montre l'application telle qu'elle est, et qui ne
// vieillit pas en silence.

const ICI = dirname(fileURLToPath(import.meta.url));
const SRC = join(ICI, '../src');
const PUBLIC = join(ICI, '../public/guide');

const fichiers = (dossier) => readdirSync(dossier).flatMap((nom) => {
  const chemin = join(dossier, nom);
  return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(jsx?|tsx?)$/.test(nom) ? [chemin] : [];
});
const CODE = fichiers(SRC).filter((f) => !f.endsWith('tourSteps.js')).map((f) => readFileSync(f, 'utf8')).join('\n');

/** Largeur et hauteur d'un JPEG, lues dans son en-tête (marqueur SOF). */
function dimensionsJpeg(chemin) {
  const b = readFileSync(chemin);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const marqueur = b[i + 1];
    const longueur = b.readUInt16BE(i + 2);
    if (marqueur >= 0xc0 && marqueur <= 0xc3) return { hauteur: b.readUInt16BE(i + 5), largeur: b.readUInt16BE(i + 7) };
    i += 2 + longueur;
  }
  return null;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('les visites guidées', () => {
  it.each(['fr', 'en'])('ne pointent que des éléments qui existent dans le code (%s)', (lang) => {
    const cibles = Object.values(getTourSteps(translations[lang])).flat()
      .map((e) => e.target)
      .filter((c) => c !== 'body');
    const absentes = cibles.filter((c) => {
      const id = c.replace(/^#/, '');
      return !new RegExp(`id=["'{]+${id}["'}]|id: ?["']${id}["']`).test(CODE);
    });
    expect(absentes).toEqual([]);
  });

  it.each(['fr', 'en'])('ont un texte pour chaque étape (%s)', (lang) => {
    const vides = Object.entries(getTourSteps(translations[lang]))
      .flatMap(([page, etapes]) => etapes.map((e, i) => [page, i, e.content]))
      .filter(([, , texte]) => typeof texte !== 'string' || !texte.trim());
    expect(vides).toEqual([]);
  });
});

describe('le guide en images', () => {
  it('a, pour chaque étape, une capture aux dimensions annoncées', () => {
    for (const etape of [...ETAPES_GUIDE.reporter, ...ETAPES_GUIDE.editor]) {
      const chemin = join(PUBLIC, etape.image);
      expect(existsSync(chemin), etape.image).toBe(true);
      // La place de l'image est réservée avec ces dimensions : fausses, la
      // page sauterait au chargement.
      expect(dimensionsJpeg(chemin), etape.image).toEqual({ largeur: etape.largeur, hauteur: etape.hauteur });
    }
  });

  it.each(['fr', 'en'])('a un titre, des points et un texte de remplacement par étape (%s)', (lang) => {
    const g = translations[lang].guide;
    for (const espace of ['reporter', 'editor']) {
      for (const etape of ETAPES_GUIDE[espace]) {
        const texte = g[espace].etapes[etape.cle];
        expect(texte.titre, `${espace}.${etape.cle}`).toBeTruthy();
        expect(texte.points.length).toBeGreaterThan(0);
        expect(texte.alt.length).toBeGreaterThan(20);
      }
    }
  });

  it('montre aux journalistes leurs cinq gestes, et ramène à l’accueil', () => {
    const retour = vi.fn();
    render(<I18nProvider><GuideView workspace="reporter" onBack={retour} /></I18nProvider>);
    expect(screen.getByRole('heading', { name: 'Comment ça marche' })).toBeInTheDocument();
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(5);
    expect(images[0]).toHaveAttribute('src', '/guide/journaliste-accueil.jpg');
    expect(images[0]).toHaveAttribute('width', '780');
    expect(screen.getByText('Suivez votre reportage')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retour/ }));
    expect(retour).toHaveBeenCalled();
  });

  it('montre au montage ses quatre temps', () => {
    render(<I18nProvider><GuideView workspace="editor" /></I18nProvider>);
    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.getByText('Publiez dans JT Prêt')).toBeInTheDocument();
  });

  it('a son adresse dans les deux espaces', () => {
    expect(parsePath('/journalistes/comment-ca-marche')).toMatchObject({ workspace: WORKSPACES.REPORTER, view: 'guide' });
    expect(parsePath('/monteurs/comment-ca-marche')).toMatchObject({ workspace: WORKSPACES.EDITOR, view: 'guide' });
    expect(buildPath(WORKSPACES.REPORTER, 'guide')).toBe('/journalistes/comment-ca-marche');
  });
});

describe('l’aide', () => {
  it('dit ce qu’elle est : « Aide », pas une intelligence artificielle', () => {
    expect(translations.fr.aiAssistant.botName).toBe('Aide');
    expect(translations.en.aiAssistant.botName).toBe('Help');
    expect(JSON.stringify(translations.fr.aiAssistant)).not.toMatch(/\bIA\b|intelligence artificielle/i);
  });

  it.each([
    ['Comment publier le JT ?', /Publier dans JT Prêt/],
    ['C’est quoi la version téléphone ?', /480p/],
    ['Comment monter le JT en un clic ?', /ordre des jingles/],
    ['Comment copier le sommaire pour YouTube ?', /chapitres/],
    ['Comment accorder un délai ?', /\+1 h, \+3 h ou \+12 h/],
  ])('répond aux questions du montage : « %s »', (question, attendu) => {
    expect(getAIResponse(question, translations.fr, 'fr')).toMatch(attendu);
  });

  it('propose des questions qui trouvent toutes une réponse', () => {
    for (const lang of ['fr', 'en']) {
      const t = translations[lang];
      for (const q of Object.values(t.aiAssistant.suggestedQuestions)) {
        expect(getAIResponse(q, t, lang), q).not.toBe(t.aiAssistant.defaultAnswer);
      }
    }
  });
});
