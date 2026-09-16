import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCallback, useRef, useState } from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import Timeline from '../src/components/editor/Timeline.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { translations } from '../src/i18n/translations.js';
import {
  annuler,
  creerHistorique,
  enregistrer,
  etiquetteSaisie,
  peutAnnuler,
  peutRetablir,
  retablir,
} from '../src/components/editor/historiqueMontage.js';

/**
 * Ce que « Annuler » doit survivre.
 *
 * L'incident : la pile d'annulation vivait dans la timeline et ne contenait
 * que des clips. Un effet la vidait dès que les clips changeaient sans venir
 * d'elle — or l'inspecteur réécrit les clips **à chaque frappe** pour piloter
 * l'aperçu en direct. Corriger une faute dans un titre faisait donc perdre la
 * coupe faite deux minutes plus tôt. Et les titres de la piste T1 n'étaient
 * pas annulables du tout.
 *
 * Ce test monte la vraie timeline sous un porteur qui reproduit le contrat du
 * tableau de bord : c'est la seule façon de vérifier que la frappe n'efface
 * plus rien, puisque le code qui effaçait a été supprimé.
 */

vi.mock('../src/utils/thumbnails.js', () => ({
  // Les miniatures lisent une vidéo : hors sujet ici, et indisponible en jsdom.
  generateThumbnails: vi.fn().mockResolvedValue([]),
}));

const dit = translations.fr.studio.timeline;

const clip = (n) => ({
  instanceId: `c${n}`,
  name: `rush-${n}.mp4`,
  filename: `rush-${n}.mp4`,
  url: `blob:rush-${n}`,
  durationSec: 5,
  // La source est plus longue que le plan : sans marge, le décalage vers la
  // droite n'a nulle part où aller — on n'invente pas des images.
  sourceDurationSec: 20,
  overlays: [],
});

/**
 * Le porteur : il détient le montage entier et l'historique, exactement comme
 * `DashboardView`. C'est lui qui fait foi — la timeline n'a plus d'historique.
 */
function Porteur({ auMontage }) {
  const [montage, setMontage] = useState({ clips: [clip(1), clip(2)], overlays: [], branding: {} });
  const [historique, setHistorique] = useState(creerHistorique);
  const ref = useRef(montage);
  ref.current = montage;

  const modifierMontage = useCallback((maj, etiquette = null, fenetre = undefined) => {
    const avant = ref.current;
    const apres = typeof maj === 'function' ? maj(avant) : { ...avant, ...maj };
    if (!apres || apres === avant) return;
    setHistorique((h) => enregistrer(h, avant, { etiquette, maintenant: Date.now(), ...(fenetre !== undefined ? { fenetre } : {}) }));
    ref.current = apres;
    setMontage(apres);
  }, []);

  const annulerMontage = useCallback(() => {
    setHistorique((h) => {
      const recul = annuler(h, ref.current);
      if (recul.etat) { ref.current = recul.etat; setMontage(recul.etat); }
      return recul.historique;
    });
  }, []);

  const retablirMontage = useCallback(() => {
    setHistorique((h) => {
      const avance = retablir(h, ref.current);
      if (avance.etat) { ref.current = avance.etat; setMontage(avance.etat); }
      return avance.historique;
    });
  }, []);

  // Ce que le test manipule de l'extérieur, comme le ferait l'inspecteur.
  auMontage.current = { montage, modifierMontage };

  return (
    <I18nProvider>
      <Timeline
        clips={montage.clips}
        setClips={() => {}}
        timelineOverlays={montage.overlays}
        setTimelineOverlays={() => {}}
        onGenerate={() => {}}
        isGenerating={false}
        modifierMontage={modifierMontage}
        annulerMontage={annulerMontage}
        retablirMontage={retablirMontage}
        annulationPossible={peutAnnuler(historique)}
        retablissementPossible={peutRetablir(historique)}
      />
    </I18nProvider>
  );
}

function poser() {
  const auMontage = { current: null };
  render(<Porteur auMontage={auMontage} />);
  // `act` parce que ces appels viennent de l'extérieur de React, comme
  // l'inspecteur : sans lui, React les regroupe et le test lit un rendu périmé.
  auMontage.modifier = (...args) => act(() => auMontage.current.modifierMontage(...args));
  return auMontage;
}

/** Le minutage tel que la timeline l'affiche : heures:minutes:secondes:images. */
const minutage = (secondes) => {
  const total = Math.max(0, Math.round(secondes * 30));
  const parts = [Math.floor(total / 108000), Math.floor(total / 1800) % 60, Math.floor(total / 30) % 60, total % 30];
  return parts.map((n) => String(n).padStart(2, '0')).join(':');
};

const boutonAnnuler = () => screen.getByRole('button', { name: new RegExp(dit.annuler, 'i') });

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('la pile d’annulation survit à ce qui n’est pas une coupe', () => {
  it('reste disponible après une frappe dans l’inspecteur', () => {
    // C'est l'incident, mot pour mot : l'aperçu en direct réécrit les clips à
    // chaque caractère, et l'ancienne pile repartait de zéro à chaque fois.
    const au = poser();
    expect(boutonAnnuler()).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(dit.supprimer, 'i') }));
    expect(au.current.montage.clips.length).toBe(1);
    expect(boutonAnnuler()).toBeEnabled();

    // Une frappe dans l'inspecteur, telle que le tableau de bord la transmet.
    au.modifier(
      (m) => ({ ...m, clips: m.clips.map((c) => ({ ...c, name: `${c.name} ` })) }),
      etiquetteSaisie('c2', 'inspecteur'),
    );

    expect(boutonAnnuler(), 'la frappe a effacé la pile').toBeEnabled();
  });

  it('annule d’abord la frappe, puis la suppression', () => {
    // L'ordre compte : le monteur veut défaire son dernier geste, pas tout.
    const au = poser();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(dit.supprimer, 'i') }));
    au.modifier(
      (m) => ({ ...m, clips: m.clips.map((c) => ({ ...c, name: 'renommé' })) }),
      etiquetteSaisie('c2', 'inspecteur'),
    );

    fireEvent.click(boutonAnnuler());
    expect(au.current.montage.clips[0].name).not.toBe('renommé');
    expect(au.current.montage.clips.length, 'la suppression a été annulée trop tôt').toBe(1);

    fireEvent.click(boutonAnnuler());
    expect(au.current.montage.clips.length).toBe(2);
  });

  it('ne demande qu’une annulation pour toute une salve de frappes', () => {
    // Quarante caractères ne doivent pas faire quarante « Annuler ».
    const au = poser();
    const etiquette = etiquetteSaisie('c1', 'inspecteur');
    for (let i = 1; i <= 40; i += 1) {
      au.modifier(
        (m) => ({ ...m, clips: m.clips.map((c, index) => (index === 0 ? { ...c, name: 'D'.repeat(i) } : c)) }),
        etiquette,
      );
    }
    expect(au.current.montage.clips[0].name).toBe('D'.repeat(40));

    fireEvent.click(boutonAnnuler());
    expect(au.current.montage.clips[0].name).toBe('rush-1.mp4');
    expect(boutonAnnuler()).toBeDisabled();
  });

  it('annule un titre ajouté depuis la timeline, et non les seuls clips', () => {
    // La piste T1 n'était pas annulable du tout : ajouter puis retirer un
    // bandeau était définitif dans les deux sens. Ce test passe par le bouton
    // réel de la timeline, pas par le porteur.
    const au = poser();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(dit.ajouterTitre, 'i') }));
    expect(au.current.montage.overlays.length).toBe(1);

    fireEvent.click(boutonAnnuler());
    expect(au.current.montage.overlays.length).toBe(0);
  });

  it('demande deux annulations pour deux suppressions, et non une seule', () => {
    // Un geste discret ne fusionne jamais, même enchaîné : supprimer deux
    // clips coup sur coup reste deux décisions. Seules la frappe et le glissé,
    // qui émettent en continu, se regroupent.
    const au = poser();
    const supprimer = () => fireEvent.click(screen.getByRole('button', { name: new RegExp(dit.supprimer, 'i') }));
    supprimer();
    supprimer();
    expect(au.current.montage.clips.length).toBe(0);

    fireEvent.click(boutonAnnuler());
    expect(au.current.montage.clips.length).toBe(1);
    fireEvent.click(boutonAnnuler());
    expect(au.current.montage.clips.length).toBe(2);
  });
});

describe('le clavier, à l’image près', () => {
  const flecheDroite = (options = {}) => fireEvent.keyDown(window, { key: 'ArrowRight', ...options });

  it('décale le clip sélectionné d’une image, sans toucher aux voisins', () => {
    // Les flèches ne déplaçaient que la tête de lecture : caler un plan
    // demandait de viser au pixel à la souris.
    const au = poser();
    const avant = au.current.montage.clips[0].durationSec;
    act(() => flecheDroite({ altKey: true }));
    const apres = au.current.montage.clips[0].durationSec;

    expect(apres).toBeCloseTo(avant + 1 / 30, 5);
    expect(au.current.montage.clips[1].durationSec, 'le plan voisin a bougé').toBe(5);
  });

  it('refuse d’inventer des images au-delà de la source', () => {
    // Un plan déjà tiré jusqu'au bout de son rush ne s'allonge pas.
    const au = poser();
    for (let i = 0; i < 40; i += 1) act(() => flecheDroite({ altKey: true, shiftKey: true }));
    expect(au.current.montage.clips[0].durationSec).toBeLessThanOrEqual(20);
  });

  it('décale d’une seconde avec Maj', () => {
    const au = poser();
    const avant = au.current.montage.clips[0].durationSec;
    act(() => flecheDroite({ altKey: true, shiftKey: true }));
    expect(au.current.montage.clips[0].durationSec).toBeCloseTo(avant + 1, 5);
  });

  it('ne touche à rien sans Alt : la flèche reste à la tête de lecture', () => {
    const au = poser();
    const avant = au.current.montage.clips[0].durationSec;
    act(() => flecheDroite());
    expect(au.current.montage.clips[0].durationSec).toBe(avant);
  });

  it('dit ce qui a bougé, et non la taille du pas', () => {
    // Le message unique « Décalé : 00:00:05:01 » laissait le monteur deviner
    // s'il lisait une position ou une durée — et sur un plan, il affichait le
    // pas (une image), qui ne lui apprenait rien.
    const au = poser();
    act(() => flecheDroite({ altKey: true }));
    const duree = au.current.montage.clips[0].durationSec;
    expect(screen.getByText(dit.msgDecaleClip(minutage(duree)))).toBeInTheDocument();
  });

  it('se tait quand le plan est déjà au bout de son rush', () => {
    // Annoncer un décalage qui n'a pas eu lieu est pire que ne rien dire.
    const au = poser();
    for (let i = 0; i < 40; i += 1) act(() => flecheDroite({ altKey: true, shiftKey: true }));
    const bloque = au.current.montage.clips[0].durationSec;
    const avant = screen.getByText(dit.msgDecaleClip(minutage(bloque)));
    act(() => flecheDroite({ altKey: true }));
    expect(avant, 'le message a changé alors que rien n’a bougé').toBeInTheDocument();
  });

  it('regroupe une rafale de décalages en une seule annulation', () => {
    // Maintenir la flèche enfoncée émet une répétition : trente entrées pour
    // un seul geste rendraient l'annulation inutilisable.
    const au = poser();
    for (let i = 0; i < 10; i += 1) act(() => flecheDroite({ altKey: true }));
    const decale = au.current.montage.clips[0].durationSec;
    expect(decale).toBeGreaterThan(5);

    fireEvent.click(boutonAnnuler());
    expect(au.current.montage.clips[0].durationSec).toBe(5);
    expect(boutonAnnuler()).toBeDisabled();
  });
});

describe('ce qu’un lecteur d’écran annonce', () => {
  // L'étiquette des blocs était composée en français dans le code, avec
  // seulement « durée » pris au dictionnaire. Un monteur anglophone entendait
  // « Titre Banc, début 00:00:05:00, duration 00:00:02:00 » — la moitié d'une
  // phrase dans chaque langue. Le lot 4 a fermé ce défaut partout ailleurs.
  it('nomme un plan dans la langue choisie', () => {
    localStorage.setItem('jt-alwm-lang', 'en');
    poser();
    const en = translations.en.studio.timeline;
    expect(screen.getByLabelText(new RegExp(`^${en.etiquetteClip(1, 'rush-1\\.mp4', '.+')}`))).toBeInTheDocument();
    expect(screen.queryByLabelText(/durée/)).toBeNull();
  });

  it('nomme un titre dans la langue choisie', () => {
    localStorage.setItem('jt-alwm-lang', 'en');
    poser();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.en.studio.timeline.ajouterTitre, 'i') }));
    expect(screen.getByLabelText(/^Title .*, starts .*, lasts /)).toBeInTheDocument();
  });
});
