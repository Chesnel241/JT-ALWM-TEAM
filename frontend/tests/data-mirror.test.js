import { describe, it, expect } from 'vitest';
import {
  OVERLAY_TEMPLATES as BACK_TEMPLATES,
} from '../../backend/src/data/overlayTemplates.js';
import {
  MOMENTS,
  MOMENTS_IDS,
  animationRecommandee,
  habillagesDuMoment,
  OVERLAY_TEMPLATES,
  CLIP_TEMPLATES,
  GLOBAL_TEMPLATES,
  TEXT_ANIMATIONS,
  TEXT_ANIMATIONS_IN,
  TEXT_ANIMATIONS_LOOP,
  TEXT_ANIMATIONS_OUT,
  FONT_FAMILIES,
} from '../src/data/overlayTemplates.js';

// Mirror frontend du registre brand ALWM (ne doit pas dériver des templates
// servis au backend / Remotion). Garde-fou minimal.

describe('OVERLAY_TEMPLATES (front)', () => {
  const ids = OVERLAY_TEMPLATES.map((t) => t.id);

  it('expose les modèles core + pack Envato', () => {
    [
      'intro_jt', 'titre_reportage', 'transition_reportage',
      'nom_interview', 'rappel_titres', 'fin_merci',
      'flash_info', 'breaking_news',
      'envato_presenter', 'envato_news', 'envato_big_title',
      'envato_ticker', 'envato_split_screen',
    ].forEach((id) => expect(ids).toContain(id));
  });

  it('CLIP_TEMPLATES + GLOBAL_TEMPLATES couvrent l\'intégralité du registre', () => {
    expect(CLIP_TEMPLATES.length + GLOBAL_TEMPLATES.length).toBe(OVERLAY_TEMPLATES.length);
  });

  it('aucun id dupliqué', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('TEXT_ANIMATIONS (front)', () => {
  it('TEXT_ANIMATIONS = TEXT_ANIMATIONS_IN', () => {
    expect(TEXT_ANIMATIONS).toBe(TEXT_ANIMATIONS_IN);
  });

  // Ces trois listes énuméraient autrefois des identifiants qui n'étaient
  // rendus par rien : `letterspread`, `kerning_shake`, `glitch_out`. Elles
  // décrivent maintenant ce que le moteur implémente vraiment, et c'est
  // `mouvement.test.js` qui compare les deux sens.

  it('TEXT_ANIMATIONS_IN couvre les trois familles d’intention', () => {
    const familles = new Set(TEXT_ANIMATIONS_IN.map((a) => a.famille));
    expect(familles).toEqual(new Set(['sobre', 'affirmee', 'marquee']));
    // Le fondu reste le recours universel : c'est lui qui rattrape toute
    // valeur inconnue venue d'un montage enregistré.
    expect(TEXT_ANIMATIONS_IN.map((a) => a.id)).toContain('fade');
  });

  it('TEXT_ANIMATIONS_LOOP garde l’immobilité comme premier choix', () => {
    // Une boucle est l'exception, pas la règle : un texte qui bouge en
    // permanence fatigue à l'antenne.
    expect(TEXT_ANIMATIONS_LOOP[0].id).toBe('none');
  });

  it('TEXT_ANIMATIONS_OUT propose d’abord de reprendre l’entrée', () => {
    // « auto » ramène le choix courant à un seul geste au lieu de trois.
    expect(TEXT_ANIMATIONS_OUT[0].id).toBe('auto');
    expect(TEXT_ANIMATIONS_OUT.map((a) => a.id)).toContain('fade');
  });

  it('chaque animation a un label non vide', () => {
    [...TEXT_ANIMATIONS_IN, ...TEXT_ANIMATIONS_LOOP, ...TEXT_ANIMATIONS_OUT].forEach((a) => {
      expect(typeof a.label).toBe('string');
      expect(a.label.length).toBeGreaterThan(0);
    });
  });
});

describe('FONT_FAMILIES (front)', () => {
  it('contient les polices brand (Montserrat) + iconiques broadcast', () => {
    [
      'Montserrat Bold', 'Montserrat Medium',
      'Inter', 'Anton', 'Bebas Neue', 'Archivo Black', 'Oswald',
    ].forEach((f) => expect(FONT_FAMILIES).toContain(f));
  });

  it('aucune entrée dupliquée', () => {
    expect(new Set(FONT_FAMILIES).size).toBe(FONT_FAMILIES.length);
  });
});

describe('le catalogue est rangé par moment du JT', () => {
  it('chaque habillage appartient à un moment connu', () => {
    // Le catalogue était rangé par portée technique — « clip » ou
    // « global » —, c'est-à-dire par un détail d'implémentation. Vingt-trois
    // vignettes en une seule liste, et il fallait les parcourir toutes pour
    // retrouver le bandeau nom.
    OVERLAY_TEMPLATES.forEach((t) => {
      expect(MOMENTS_IDS, `${t.id} : moment « ${t.moment} »`).toContain(t.moment);
    });
  });

  it('aucun moment n’est vide', () => {
    // Un onglet vide dans le sélecteur est une promesse non tenue.
    MOMENTS.forEach((m) => {
      expect(habillagesDuMoment(m.id).length, m.id).toBeGreaterThan(0);
    });
  });

  it('les six moments couvrent tout le catalogue, sans doublon', () => {
    const repartis = MOMENTS.flatMap((m) => habillagesDuMoment(m.id));
    expect(repartis.length).toBe(OVERLAY_TEMPLATES.length);
    expect(new Set(repartis.map((t) => t.id)).size).toBe(OVERLAY_TEMPLATES.length);
  });

  it('ne nomme plus un fournisseur ni une mode graphique', () => {
    // « (Envato Premium) » nommait un fournisseur, « Glassmorphism » une mode.
    // Ni l'un ni l'autre n'aide un monteur à choisir sous la pression.
    OVERLAY_TEMPLATES.forEach((t) => {
      expect(t.label, t.id).not.toMatch(/envato|glassmorphism|lower third|skew/i);
    });
  });
});

describe('chaque habillage naît avec un mouvement qui lui va', () => {
  it('propose une animation implémentée, pour les vingt-trois', () => {
    // Tout habillage naissait en « Fondu », quel qu'il soit : le monteur
    // devait corriger à chaque fois, ou livrer vingt-trois fondus.
    const proposees = TEXT_ANIMATIONS_IN.map((a) => a.id);
    OVERLAY_TEMPLATES.forEach((t) => {
      expect(proposees, t.id).toContain(animationRecommandee(t.id));
    });
  });

  it('retombe sur le fondu pour un habillage inconnu', () => {
    // Un montage enregistré peut porter un identifiant que le catalogue ne
    // propose plus. Mieux vaut un fondu qu'un plantage du sélecteur.
    expect(animationRecommandee('habillage_disparu')).toBe('fade');
  });
});

describe('le studio et le serveur décrivent les mêmes habillages', () => {
  const back = new Map(BACK_TEMPLATES.map((t) => [t.id, t]));
  const portee = (t) => t.scope || 'clip';
  const cles = (t) => (t.fields || []).map((f) => f.key).join(',');

  it('les deux catalogues contiennent exactement les mêmes identifiants', () => {
    expect(OVERLAY_TEMPLATES.map((t) => t.id).sort()).toEqual(BACK_TEMPLATES.map((t) => t.id).sort());
  });

  it('la portée ne diverge pas', () => {
    // Elle divergeait pour trois habillages : le studio les rangeait dans
    // l'habillage global, le serveur les croyait attachés à un clip.
    OVERLAY_TEMPLATES.forEach((t) => {
      expect(portee(back.get(t.id)), t.id).toBe(portee(t));
    });
  });

  it('les champs déclarés sont les mêmes, dans le même ordre', () => {
    // C'est la divergence qui a laissé « WHAT IS GOING ON IN THE WORLD »
    // partir à l'antenne : un composant lisant des champs que le catalogue
    // ne déclarait pas.
    OVERLAY_TEMPLATES.forEach((t) => {
      expect(cles(back.get(t.id)), t.id).toBe(cles(t));
    });
  });

  it('le serveur ne porte plus de texte d’affichage', () => {
    // Libellés, emojis et aperçus y étaient recopiés du studio, déjà
    // divergents, et lus par personne. Une donnée d'affichage que rien
    // n'affiche ne peut que pourrir.
    BACK_TEMPLATES.forEach((t) => {
      expect(Object.keys(t).sort(), t.id).toEqual(t.scope ? ['fields', 'id', 'scope'] : ['fields', 'id']);
      (t.fields || []).forEach((f) => expect(Object.keys(f), `${t.id}.${f.key}`).toEqual(['key']));
    });
  });
});
