/**
 * Le paquet d'antenne du JT ALWM.
 *
 * LE CONSTAT : les habillages étaient propres mais timides — de petits
 * cartouches de site web, qui entraient d'un fondu ou d'un glissé, tous du
 * même geste. À l'antenne, un habillage se construit par CALQUES, comme dans
 * un logiciel de composition : un filet se dessine, un volet s'ouvre à partir
 * de lui, le texte monte derrière un cache, une précision se déplie dessous.
 * Chaque calque a son départ, décalé de quelques images, et tous suivent la
 * même courbe : rapide au début, longue à se poser, sans rebond. La sortie
 * reprend le chemin inverse, en dix images.
 *
 * Rien ne bouge une fois l'habillage posé : c'est l'image qui doit vivre, pas
 * le bandeau. Les seules exceptions sont celles qui disent quelque chose (le
 * point d'une alerte, un bandeau qui défile).
 *
 * Ce fichier tient le socle (les calques) et tous les habillages. Les
 * couleurs viennent de la charte (`identite.js`) et restent réglables par le
 * monteur (texte, fond, accent) ; la police aussi.
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig, Img, staticFile } from 'remotion';
import { COULEURS, VOILES, POLICE_HABILLAGE, PILES, LETTRAGE, varPolice } from '../identite.js';
import { pickColors } from '../theme.js';
import TexteJT from '../TexteJT.jsx';

/* ------------------------------------------------------------------ */
/* Le socle                                                            */
/* ------------------------------------------------------------------ */

/**
 * Ce qui occupe déjà l'image en permanence : le logo dans un coin, la pastille
 * « DIRECT » en haut à droite, le bandeau défilant en bas.
 *
 * L'INCIDENT, vu sur un JT rendu avec tout l'habillage : un nom posé en bas à
 * droite passait SOUS le logo, qui en cachait la moitié. Chaque élément avait
 * été réglé seul. Le montage fournit donc ce contexte, et chaque habillage
 * s'écarte de lui-même de ce qui est déjà là.
 */
export const Antenne = React.createContext({ logo: null, direct: false, defilant: false });

/** Le décalage vertical (en px, vers l'intérieur de l'image) qu'impose l'habillage permanent. */
export function ecartPermanent(coin, antenne) {
  const a = antenne || {};
  if (coin === 'bas') return a.defilant ? 76 : 0;
  let ecart = 0;
  if (a.logo === coin) ecart = Math.max(ecart, 170);
  if (a.direct && coin === 'haut-droite') ecart = Math.max(ecart, 100);
  return ecart;
}

/** Marges de sécurité : rien d'important à moins de 5 % du bord. */
export const MARGE = 96;
const borne = (v) => Math.max(0, Math.min(1, v));
/** Rapide au départ, longue à se poser, sans rebond. */
export const poser = (t) => 1 - (1 - borne(t)) ** 4;
/** La sortie accélère : elle s'efface, elle ne se pose pas. */
export const quitter = (t) => borne(t) ** 3;
/** Attaque franche, longue tenue : une alerte claque, sans rebondir. */
export const franc = (t) => (borne(t) >= 1 ? 1 : 1 - 2 ** (-10 * borne(t)));
/** Pose lente : un chiffre, une donnée se lisent pendant qu'ils arrivent. */
export const doux = (t) => Math.sin((borne(t) * Math.PI) / 2);

/**
 * Une courbe par famille d'habillage, et sa sortie en images.
 *
 * LE CONSTAT : tous les calques entraient avec la même courbe. Propre, mais
 * tout se posait de la même façon, et un JT entier finissait par paraître
 * mécanique. Une alerte n'arrive pas comme un chiffre : elle claque et repart
 * vite ; un chiffre se pose et laisse le temps de le lire.
 */
export const COURBES = Object.freeze({
  poser: Object.freeze({ entree: poser, sortie: 10 }),
  franc: Object.freeze({ entree: franc, sortie: 7 }),
  doux: Object.freeze({ entree: doux, sortie: 12 }),
});

/**
 * Les calques d'un habillage. `p(delai, duree)` rend la présence d'un calque,
 * de 0 à 1 : il entre à `delai` images, met `duree` images à se poser, et
 * repart avec tous les autres dans les dernières images (dix par défaut).
 */
export function useCalques(durationInFrames, courbe = 'poser') {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = fps / 30;
  const { entree, sortie } = COURBES[courbe] || COURBES.poser;
  const fin = Number.isFinite(durationInFrames) && durationInFrames > 0 ? durationInFrames : Infinity;
  const depart = quitter((frame - (fin - sortie * k)) / (sortie * k));
  const p = (delai = 0, duree = 14) => entree((frame - delai * k) / (duree * k)) * (1 - depart);
  return { frame, k, p, depart };
}

/** Un volet : le calque se découvre d'un bord vers l'autre. */
export function Volet({ p, depuis = 'gauche', style, children }) {
  const cache = `${((1 - p) * 100).toFixed(2)}%`;
  const inset = {
    gauche: `inset(0 ${cache} 0 0)`,
    droite: `inset(0 0 0 ${cache})`,
    haut: `inset(0 0 ${cache} 0)`,
    bas: `inset(${cache} 0 0 0)`,
  }[depuis];
  return <div style={{ clipPath: inset, WebkitClipPath: inset, ...style }}>{children}</div>;
}

/** Le texte monte derrière un cache : il apparaît sans glisser sur l'image. */
export function Monte({ p, depuis = 'bas', style, children }) {
  const ecart = `${((1 - p) * (depuis === 'bas' ? 108 : -108)).toFixed(2)}%`;
  return (
    <div style={{ overflow: 'hidden', ...style }}>
      <div style={{ transform: `translateY(${ecart})` }}>{children}</div>
    </div>
  );
}

/** Un filet qui se dessine depuis une extrémité. */
export function Filet({ p, vertical = false, epaisseur = 6, longueur = '100%', couleur, origine, style }) {
  return (
    <div style={{
      background: couleur,
      width: vertical ? epaisseur : longueur,
      height: vertical ? longueur : epaisseur,
      transform: vertical ? `scaleY(${p.toFixed(4)})` : `scaleX(${p.toFixed(4)})`,
      transformOrigin: origine || (vertical ? 'bottom' : 'left'),
      flexShrink: 0,
      ...style,
    }} />
  );
}

/** Un reflet qui traverse le calque une seule fois, au moment où il se pose. */
export function Reflet({ frame, k = 1, debut = 14, duree = 22 }) {
  const t = (frame - debut * k) / (duree * k);
  if (t <= 0 || t >= 1) return null;
  return (
    <div style={{
      position: 'absolute', top: 0, bottom: 0, width: '34%',
      left: `${(-34 + t * 134).toFixed(2)}%`,
      background: VOILES.reflet,
      pointerEvents: 'none',
    }} />
  );
}

/**
 * Place un habillage dans l'image, et lui applique les réglages du monteur :
 * décalage, taille de l'ensemble, police.
 */
export function Cadre({ overlay, ancre = 'bas-gauche', style, children }) {
  const x = Number(overlay.posX) || 0;
  const y = Number(overlay.posY) || 0;
  const s = (Number(overlay.scale) || 100) / 100;
  const ancres = {
    'bas-gauche': { left: MARGE, bottom: MARGE, transformOrigin: 'bottom left' },
    'bas-droite': { right: MARGE, bottom: MARGE, transformOrigin: 'bottom right' },
    'haut-gauche': { left: MARGE, top: MARGE, transformOrigin: 'top left' },
    'haut-droite': { right: MARGE, top: MARGE, transformOrigin: 'top right' },
    bas: { left: 0, right: 0, bottom: 0, transformOrigin: 'bottom center' },
    plein: { inset: 0, transformOrigin: 'center' },
  };
  // Le monteur peut poser un habillage de coin dans un autre coin.
  const coins = ['bas-gauche', 'bas-droite', 'haut-gauche', 'haut-droite'];
  const choisie = coins.includes(ancre) && coins.includes(overlay.place) ? overlay.place : ancre;
  // On s'écarte de ce qui est déjà à l'antenne (logo, pastille, bandeau).
  const ecart = ecartPermanent(choisie, React.useContext(Antenne));
  const pousse = choisie.startsWith('haut') ? ecart : -ecart;
  return (
    <div style={{
      position: 'absolute', ...ancres[choisie],
      transform: `translate(${x}px, ${y + pousse}px) scale(${s})`,
      fontFamily: POLICE_HABILLAGE,
      ...varPolice(overlay),
      ...style,
    }}>{children}</div>
  );
}

/** Les couleurs de l'habillage : la charte, sauf réglage du monteur. */
function teintes(overlay) {
  const C = pickColors(overlay);
  return {
    fond: C.bg(COULEURS.structure),
    accent: C.accent(COULEURS.accent),
    texte: C.text(COULEURS.papier),
    papier: COULEURS.papier,
    encre: COULEURS.encre,
    profond: COULEURS.fond,
    alerte: COULEURS.alerte,
  };
}

const taille = (overlay, px) => `${Math.round(px * ((Number(overlay.fontSize) || 100) / 100))}px`;
const titrage = { fontWeight: 700, textTransform: 'uppercase', letterSpacing: LETTRAGE.titre, lineHeight: 1.04, whiteSpace: 'nowrap' };
const courant = { fontFamily: PILES.courant, fontWeight: 600, letterSpacing: '0.01em', lineHeight: 1.15, whiteSpace: 'nowrap' };
const mention = { fontFamily: PILES.courant, fontWeight: 700, textTransform: 'uppercase', letterSpacing: LETTRAGE.mention, lineHeight: 1, whiteSpace: 'nowrap' };
/** Ce qui détache un bandeau d'une image claire, sans halo. */
const assise = VOILES.assise;

const champ = (overlay, ...cles) => {
  const f = overlay.fields || {};
  for (const cle of cles) if (typeof f[cle] === 'string' && f[cle].trim()) return f[cle].trim();
  return '';
};

/* ------------------------------------------------------------------ */
/* Nommer quelqu'un                                                    */
/* ------------------------------------------------------------------ */

/**
 * Le bandeau de nom du JT : un filet clair se dresse, le nom s'ouvre à partir
 * de lui sur le bleu de la chaîne, la fonction se déplie dessous sur papier.
 */
export function NomBandeau({ overlay, durationInFrames, ancre = 'bas-gauche' }) {
  const { frame, k, p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const nom = champ(overlay, 'nom', 'name', 'texte');
  const fonction = champ(overlay, 'fonction', 'title', 'categorie');
  const aDroite = ancre === 'bas-droite';
  return (
    <Cadre overlay={overlay} ancre={ancre}>
      <div style={{ display: 'flex', flexDirection: aDroite ? 'row-reverse' : 'row', alignItems: 'stretch', filter: `drop-shadow(${assise})` }}>
        <Filet vertical p={p(0, 9)} epaisseur={10} couleur={T.accent} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: aDroite ? 'flex-end' : 'flex-start' }}>
          <Volet p={p(2, 14)} depuis={aDroite ? 'droite' : 'gauche'} style={{ position: 'relative', background: T.fond, padding: '16px 40px 14px 30px', overflow: 'hidden' }}>
            <Monte p={p(5, 14)}>
              <TexteJT role="titrage" delai={5} style={{ ...titrage, fontSize: taille(overlay, 62), color: T.texte }}>{nom}</TexteJT>
            </Monte>
            <Reflet frame={frame} k={k} />
          </Volet>
          {fonction && (
            <Volet p={p(8, 12)} depuis="haut" style={{ background: T.papier, padding: '11px 30px 12px 30px' }}>
              <Monte p={p(10, 12)} depuis="haut">
                <TexteJT role="courant" delai={10} style={{ ...courant, fontSize: taille(overlay, 30), color: T.encre }}>{fonction}</TexteJT>
              </Monte>
            </Volet>
          )}
        </div>
      </div>
    </Cadre>
  );
}

/** Deux blocs décalés : le nom sur papier, la fonction sur le bleu, en retrait. */
export function NomDeuxBlocs({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const nom = champ(overlay, 'nom', 'name');
  const fonction = champ(overlay, 'fonction', 'title');
  return (
    <Cadre overlay={overlay}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', filter: `drop-shadow(${assise})` }}>
        <Volet p={p(0, 14)} style={{ position: 'relative', background: T.papier, padding: '16px 44px 14px 34px', overflow: 'hidden' }}>
          <Monte p={p(4, 14)}>
            <TexteJT role="titrage" delai={4} style={{ ...titrage, fontSize: taille(overlay, 62), color: T.encre }}>{nom}</TexteJT>
          </Monte>
          <Reflet frame={frame} k={k} debut={12} />
        </Volet>
        {fonction && (
          <Volet p={p(6, 13)} style={{ background: T.fond, padding: '10px 30px 11px 30px', marginLeft: 34, marginTop: -2 }}>
            <Monte p={p(9, 12)}>
              <TexteJT role="courant" delai={9} style={{ ...mention, fontSize: taille(overlay, 24), color: T.texte }}>{fonction}</TexteJT>
            </Monte>
          </Volet>
        )}
        <Filet p={p(10, 14)} epaisseur={6} longueur={120} couleur={T.accent} style={{ marginTop: 10, marginLeft: 34 }} />
      </div>
    </Cadre>
  );
}

/** Une seule ligne : le nom posé sur un voile sombre, souligné d'un filet qui se trace. */
export function NomLigne({ overlay, durationInFrames }) {
  const { p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const nom = champ(overlay, 'nom', 'name');
  return (
    <Cadre overlay={overlay}>
      <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
        <Volet p={p(0, 13)} style={{ background: VOILES.panneau, padding: '14px 34px 12px 30px' }}>
          <Monte p={p(4, 13)}>
            <TexteJT role="titrage" delai={4} style={{ ...titrage, fontSize: taille(overlay, 54), color: T.texte }}>{nom}</TexteJT>
          </Monte>
        </Volet>
        <Filet p={p(6, 18)} epaisseur={6} couleur={T.accent} />
      </div>
    </Cadre>
  );
}

/** Le présentateur : une mention au-dessus, le nom en grand, la fonction dessous. */
export function NomPresentateur({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const surtitre = champ(overlay, 'context');
  const nom = champ(overlay, 'name', 'nom');
  const fonction = champ(overlay, 'title', 'fonction');
  return (
    <Cadre overlay={overlay}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', filter: `drop-shadow(${assise})` }}>
        {surtitre && (
          <Volet p={p(6, 12)} depuis="bas" style={{ background: T.accent, padding: '8px 18px 8px 18px' }}>
            <TexteJT role="courant" delai={8} style={{ ...mention, fontSize: taille(overlay, 22), color: T.profond }}>{surtitre}</TexteJT>
          </Volet>
        )}
        <Volet p={p(0, 14)} style={{ position: 'relative', background: T.fond, padding: '18px 48px 16px 34px', overflow: 'hidden' }}>
          <Monte p={p(4, 14)}>
            <TexteJT role="titrage" delai={4} style={{ ...titrage, fontSize: taille(overlay, 72), color: T.texte }}>{nom}</TexteJT>
          </Monte>
          <Reflet frame={frame} k={k} />
        </Volet>
        {fonction && (
          <Volet p={p(8, 12)} depuis="haut" style={{ background: T.papier, padding: '11px 34px 12px 34px' }}>
            <Monte p={p(10, 12)} depuis="haut">
              <TexteJT role="courant" delai={10} style={{ ...courant, fontSize: taille(overlay, 30), color: T.encre }}>{fonction}</TexteJT>
            </Monte>
          </Volet>
        )}
      </div>
    </Cadre>
  );
}

/** Deux invités face à face : un bandeau de chaque côté de l'image. */
export function NomDeuxInvites({ overlay, durationInFrames }) {
  const cote = (nom, fonction) => ({ ...overlay, fields: { ...overlay.fields, nom, fonction } });
  const f = overlay.fields || {};
  return (
    <>
      {(f.leftName || '').trim() && <NomBandeau overlay={cote(f.leftName, f.leftRole || '')} durationInFrames={durationInFrames} />}
      {(f.rightName || '').trim() && <NomBandeau overlay={cote(f.rightName, f.rightRole || '')} durationInFrames={durationInFrames} ancre="bas-droite" />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Titrer un sujet                                                     */
/* ------------------------------------------------------------------ */

const lireTitre = (overlay) => [champ(overlay, 'titre', 'sujet', 'title'), champ(overlay, 'sous_titre', 'subtitle')];

/** Le titre de sujet du JT : filet, grand titre sur le bleu, précision sur papier. */
export function TitreBandeau({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const [titre, sous] = lireTitre(overlay);
  return (
    <Cadre overlay={overlay}>
      <div style={{ display: 'flex', alignItems: 'stretch', filter: `drop-shadow(${assise})` }}>
        <Filet vertical p={p(0, 9)} epaisseur={12} couleur={T.accent} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <Volet p={p(2, 16)} style={{ position: 'relative', background: T.fond, padding: '20px 56px 18px 34px', overflow: 'hidden' }}>
            <Monte p={p(6, 15)}>
              <TexteJT role="titrage" delai={6} style={{ ...titrage, fontSize: taille(overlay, 78), color: T.texte }}>{titre}</TexteJT>
            </Monte>
            <Reflet frame={frame} k={k} debut={16} />
          </Volet>
          {sous && (
            <Volet p={p(9, 13)} depuis="haut" style={{ background: T.papier, padding: '12px 34px 13px 34px' }}>
              <Monte p={p(11, 12)} depuis="haut">
                <TexteJT role="courant" delai={11} style={{ ...courant, fontSize: taille(overlay, 32), color: T.encre }}>{sous}</TexteJT>
              </Monte>
            </Volet>
          )}
        </div>
      </div>
    </Cadre>
  );
}

/**
 * Sans cartouche : le titre posé sur l'image, tenu par un dégradé sombre qui
 * monte du bas, et un filet qui se trace entre le titre et sa précision.
 */
export function TitreFilet({ overlay, durationInFrames }) {
  const { p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const [titre, sous] = lireTitre(overlay);
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 520, opacity: p(0, 18), background: VOILES.pied }} />
      <Cadre overlay={overlay}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <Monte p={p(3, 16)}>
            <TexteJT role="titrage" delai={3} style={{ ...titrage, fontSize: taille(overlay, 92), color: T.texte }}>{titre}</TexteJT>
          </Monte>
          <Filet p={p(6, 20)} epaisseur={5} couleur={T.accent} style={{ margin: '14px 0 16px' }} />
          {sous && (
            <Monte p={p(10, 14)} depuis="haut">
              <TexteJT role="courant" delai={10} style={{ ...courant, fontWeight: 500, fontSize: taille(overlay, 36), color: T.texte }}>{sous}</TexteJT>
            </Monte>
          )}
        </div>
      </Cadre>
    </>
  );
}

/** Deux blocs en biseau, décalés : le geste le plus vif du paquet. */
export function TitreBiseau({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const [titre, sous] = lireTitre(overlay);
  const biseau = 'skewX(-12deg)';
  const droit = 'skewX(12deg)';
  return (
    <Cadre overlay={overlay} style={{ paddingLeft: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', filter: `drop-shadow(${assise})` }}>
        <Volet p={p(0, 14)} style={{ transform: biseau, position: 'relative', background: T.fond, padding: '18px 60px 16px 44px', overflow: 'hidden' }}>
          <Monte p={p(4, 14)}>
            <TexteJT role="titrage" delai={4} style={{ ...titrage, transform: droit, fontSize: taille(overlay, 78), color: T.texte }}>{titre}</TexteJT>
          </Monte>
          <Reflet frame={frame} k={k} />
        </Volet>
        <div style={{ display: 'flex', alignItems: 'stretch', marginLeft: 40, marginTop: 6 }}>
          {sous && (
            <Volet p={p(6, 13)} style={{ transform: biseau, background: T.papier, padding: '11px 36px 12px 36px' }}>
              <Monte p={p(9, 12)}>
                <TexteJT role="courant" delai={9} style={{ ...courant, transform: droit, fontSize: taille(overlay, 30), color: T.encre }}>{sous}</TexteJT>
              </Monte>
            </Volet>
          )}
          <div style={{ transform: biseau, marginLeft: 8, display: 'flex' }}>
            <Filet vertical p={p(11, 10)} epaisseur={16} couleur={T.accent} origine="top" />
          </div>
        </div>
      </div>
    </Cadre>
  );
}

/** Le bandeau en dégradé, traversé d'un balayage clair au moment où il s'ouvre. */
export function TitreBalayage({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const [titre, sous] = lireTitre(overlay);
  return (
    <Cadre overlay={overlay}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', filter: `drop-shadow(${assise})` }}>
        <Volet p={p(0, 16)} style={{ position: 'relative', background: `linear-gradient(95deg, ${T.profond}, ${T.fond} 55%, ${COULEURS.accentSoutenu})`, padding: '20px 64px 16px 36px', overflow: 'hidden' }}>
          <Monte p={p(5, 15)}>
            <TexteJT role="titrage" delai={5} style={{ ...titrage, fontSize: taille(overlay, 78), color: T.texte }}>{titre}</TexteJT>
          </Monte>
          {sous && (
            <Monte p={p(9, 13)} style={{ marginTop: 6 }}>
              <TexteJT role="courant" delai={9} style={{ ...courant, fontWeight: 500, fontSize: taille(overlay, 30), color: T.texte, opacity: 0.9 }}>{sous}</TexteJT>
            </Monte>
          )}
          <Reflet frame={frame} k={k} debut={4} duree={26} />
        </Volet>
        <Filet p={p(8, 20)} epaisseur={6} couleur={T.accent} />
      </div>
    </Cadre>
  );
}

/** Un panneau translucide qui laisse deviner l'image, cerné d'un liseré clair. */
export function TitreVerre({ overlay, durationInFrames }) {
  const { p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const [titre, sous] = lireTitre(overlay);
  return (
    <Cadre overlay={overlay}>
      <Volet p={p(0, 16)} depuis="bas">
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          padding: '24px 56px 22px 40px',
          background: VOILES.verre,
          backdropFilter: 'blur(22px) saturate(1.2)', WebkitBackdropFilter: 'blur(22px) saturate(1.2)',
          borderTop: `2px solid ${T.accent}`,
          boxShadow: `inset 0 0 0 1px ${VOILES.lisere}`,
        }}>
          <Monte p={p(5, 15)}>
            <TexteJT role="titrage" delai={5} style={{ ...titrage, fontSize: taille(overlay, 76), color: T.texte }}>{titre}</TexteJT>
          </Monte>
          {sous && (
            <Monte p={p(9, 13)} style={{ marginTop: 8 }}>
              <TexteJT role="courant" delai={9} style={{ ...courant, fontWeight: 500, fontSize: taille(overlay, 32), color: T.texte, opacity: 0.88 }}>{sous}</TexteJT>
            </Monte>
          )}
        </div>
      </Volet>
    </Cadre>
  );
}

/** Une bande sur toute la largeur : pour ouvrir un sujet fort. */
export function TitreMassif({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const [titre, sous] = lireTitre(overlay);
  return (
    <Cadre overlay={overlay} ancre="bas">
      <Filet p={p(0, 18)} epaisseur={8} couleur={T.accent} />
      <Volet p={p(2, 16)} depuis="bas" style={{ position: 'relative', background: T.fond, padding: `30px ${MARGE}px 34px`, overflow: 'hidden', minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Monte p={p(7, 16)}>
          <TexteJT role="titrage" delai={7} style={{ ...titrage, fontSize: taille(overlay, 118), color: T.texte }}>{titre}</TexteJT>
        </Monte>
        {sous && (
          <Monte p={p(12, 14)} style={{ marginTop: 6 }}>
            <TexteJT role="courant" delai={12} style={{ ...mention, fontSize: taille(overlay, 30), color: T.accent }}>{sous}</TexteJT>
          </Monte>
        )}
        <Reflet frame={frame} k={k} debut={18} duree={30} />
      </Volet>
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* Alerter, situer, citer                                              */
/* ------------------------------------------------------------------ */

/** L'alerte en bandeau : une mention rouge dont le point bat, puis l'information. */
export function AlerteBandeau({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames, 'franc');
  const T = teintes(overlay);
  const tag = champ(overlay, 'tag');
  const info = champ(overlay, 'headline', 'texte');
  // Le point bat : c'est lui qui dit « en ce moment ».
  const battement = 0.45 + 0.55 * Math.abs(Math.cos((frame / (30 * k)) * Math.PI));
  return (
    <Cadre overlay={overlay}>
      <div style={{ display: 'flex', alignItems: 'stretch', filter: `drop-shadow(${assise})` }}>
        {tag && (
          <Volet p={p(0, 11)} style={{ background: T.alerte, padding: '0 28px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: T.papier, opacity: battement }} />
            <TexteJT role="courant" delai={2} style={{ ...mention, fontSize: taille(overlay, 30), color: T.papier }}>{tag}</TexteJT>
          </Volet>
        )}
        <Volet p={p(3, 16)} style={{ position: 'relative', background: T.papier, padding: '18px 48px 16px 32px', overflow: 'hidden' }}>
          <Monte p={p(7, 14)}>
            <TexteJT role="titrage" delai={7} style={{ ...titrage, fontSize: taille(overlay, 60), color: T.encre }}>{info}</TexteJT>
          </Monte>
          <Reflet frame={frame} k={k} debut={16} />
        </Volet>
      </div>
    </Cadre>
  );
}

/** Le lieu, en haut à gauche : un repère, puis le nom qui s'ouvre à côté. */
export function Lieu({ overlay, durationInFrames }) {
  const { p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const lieu = champ(overlay, 'location');
  return (
    <Cadre overlay={overlay} ancre="haut-gauche">
      <div style={{ display: 'flex', alignItems: 'stretch', filter: `drop-shadow(${assise})` }}>
        <Volet p={p(0, 10)} depuis="bas" style={{ background: T.accent, width: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={T.profond} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.6" />
          </svg>
        </Volet>
        <Volet p={p(3, 14)} style={{ background: T.fond, padding: '18px 34px 16px 26px' }}>
          <Monte p={p(6, 13)}>
            <TexteJT role="courant" delai={6} style={{ ...mention, fontSize: taille(overlay, 34), color: T.texte }}>{lieu}</TexteJT>
          </Monte>
        </Volet>
      </div>
    </Cadre>
  );
}

/** La citation : un grand guillemet, la phrase sur un voile sombre, puis son auteur. */
export function Citation({ overlay, durationInFrames }) {
  const { p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const phrase = champ(overlay, 'quote');
  const auteur = champ(overlay, 'author');
  return (
    <Cadre overlay={overlay} style={{ maxWidth: 1240 }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <Filet vertical p={p(0, 12)} epaisseur={10} couleur={T.accent} />
        <Volet p={p(2, 16)} style={{ background: VOILES.panneau, padding: '30px 52px 30px 40px' }}>
          <div style={{ fontFamily: POLICE_HABILLAGE, fontWeight: 700, fontSize: 130, lineHeight: 0.6, height: 50, color: T.accent, opacity: p(4, 12) }}>“</div>
          <Monte p={p(6, 16)}>
            <TexteJT role="courant" delai={6} style={{ fontFamily: PILES.courant, fontWeight: 500, fontSize: taille(overlay, 48), lineHeight: 1.22, color: T.texte, whiteSpace: 'normal', maxWidth: 1100 }}>{phrase}</TexteJT>
          </Monte>
          {auteur && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 22 }}>
              <Filet p={p(12, 12)} epaisseur={4} longueur={56} couleur={T.accent} />
              <Monte p={p(13, 12)}>
                <TexteJT role="courant" delai={13} style={{ ...mention, fontSize: taille(overlay, 26), color: T.texte }}>{auteur}</TexteJT>
              </Monte>
            </div>
          )}
        </Volet>
      </div>
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* Les écrans pleins                                                   */
/* ------------------------------------------------------------------ */

/**
 * Le fond d'antenne.
 *
 * LE CONSTAT : les écrans pleins étaient presque vides, puis habités par un
 * globe filaire qui tournait — l'image même du décor fabriqué. Un plateau de
 * journal n'a pas de globe : il a de la LUMIÈRE et des PLANS. Le fond est donc
 * fait de ce qu'on trouverait dans un studio :
 *   - de grands pans de verre inclinés, qui glissent à des vitesses
 *     différentes (c'est ce décalage qui donne la profondeur) et accrochent
 *     la lumière par leur arête ;
 *   - deux nappes de lumière, floues, qui se déplacent lentement derrière ;
 *   - un faisceau qui balaie l'image une fois, à l'ouverture.
 * À l'ouverture, les pans arrivent vite et se posent ; ensuite ils dérivent à
 * peine. Le texte reste ce qui bouge le plus.
 */
function FondAntenne({ p, frame, k, T, teinte, avance = 0, children }) {
  const t = frame / k;
  // L'élan de l'ouverture : les pans viennent de loin, puis dérivent.
  const elan = 1 - poser(t / 26);
  // [position de départ en %, largeur en %, vitesse de dérive, opacité, sens de l'élan]
  const pans = [
    [-8, 34, 0.035, 0.10, -1],
    [22, 22, -0.055, 0.07, 1],
    [48, 40, 0.025, 0.09, -1],
    [78, 26, -0.04, 0.08, 1],
  ];
  const faisceau = (t - 6) / 34;
  return (
    <Volet p={p} depuis="bas" style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: `linear-gradient(165deg, ${T.profond} 0%, ${teinte || COULEURS.fondMilieu} 55%, ${T.fond} 140%)` }}>
      {/* Les nappes de lumière, loin derrière. */}
      {[[18, 30, 0.011, 0.5], [76, 68, 0.008, 0.36]].map(([x, y, v, op], i) => (
        <div key={`n${i}`} style={{
          position: 'absolute', width: 1300, height: 1300, borderRadius: '50%',
          left: `calc(${(x + Math.sin(t * v + i * 2) * 9).toFixed(2)}% - 650px)`,
          top: `calc(${(y + Math.cos(t * v * 1.3 + i) * 7).toFixed(2)}% - 650px)`,
          background: `radial-gradient(circle, ${i ? T.accent : T.fond}, transparent 62%)`,
          opacity: op * 0.5, filter: 'blur(40px)',
        }} />
      ))}
      {/* Les pans de verre : un voile clair, et une arête qui accroche la lumière. */}
      {pans.map(([x, largeur, vitesse, opacite, sens], i) => (
        <div key={`p${i}`} style={{
          position: 'absolute', top: '-20%', height: '140%', width: `${largeur}%`,
          left: `${(x + t * vitesse + elan * sens * 46 - avance * (7 + i * 3)).toFixed(3)}%`,
          transform: 'skewX(-18deg)',
          background: `linear-gradient(90deg, ${T.papier}, transparent 85%)`,
          opacity: opacite * (1 - elan * 0.6),
          borderLeft: `2px solid ${T.accent}`,
        }} />
      ))}
      {/* Le faisceau de l'ouverture. */}
      {faisceau > 0 && faisceau < 1 && (
        <div style={{ position: 'absolute', top: '-20%', height: '140%', width: '26%', left: `${(-30 + faisceau * 160).toFixed(2)}%`, transform: 'skewX(-18deg)', background: VOILES.reflet, opacity: 0.55 }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: VOILES.bords }} />
      {children}
    </Volet>
  );
}

/** Le générique : les rubriques se succèdent, puis le titre du journal s'installe. */
export function Generique({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const titre = champ(overlay, 'titre') || 'LE JOURNAL';
  const mots = champ(overlay, 'mots').split('•').map((m) => m.trim()).filter(Boolean).slice(0, 6);
  const PAS = 11;
  const debutTitre = 10 + mots.length * PAS;
  return (
    <FondAntenne p={p(0, 14)} frame={frame} k={k} T={T}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: POLICE_HABILLAGE, ...varPolice(overlay) }}>
        {mots.map((mot, i) => {
          const local = frame / k - (10 + i * PAS);
          if (local < 0 || local >= PAS) return null;
          // Chaque rubrique monte, tient, puis s'efface vers le haut.
          const entree = poser(local / 5);
          const sortie = quitter((local - (PAS - 4)) / 4);
          return (
            <div key={mot} style={{ position: 'absolute', overflow: 'hidden' }}>
              <div style={{ ...titrage, fontSize: taille(overlay, 96), letterSpacing: '0.14em', color: T.accent, transform: `translateY(${((1 - entree) * 105 - sortie * 105).toFixed(2)}%)` }}>{mot}</div>
            </div>
          );
        })}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Img src={staticFile('images/alwm-logo-sombre.png')} style={{ width: 300, objectFit: 'contain', marginBottom: 34, opacity: p(debutTitre, 16), transform: `scale(${(0.94 + 0.06 * p(debutTitre, 22)).toFixed(4)})` }} />
          <Filet p={p(debutTitre + 2, 20)} epaisseur={6} longueur={520} couleur={T.accent} origine="center" />
          <Monte p={p(debutTitre + 4, 18)} style={{ margin: '22px 0 20px' }}>
            <TexteJT role="titrage" delai={debutTitre + 4} style={{ ...titrage, fontSize: taille(overlay, 190), letterSpacing: '0.03em', color: T.texte }}>{titre}</TexteJT>
          </Monte>
          <Filet p={p(debutTitre + 8, 20)} epaisseur={6} longueur={520} couleur={T.accent} origine="center" />
        </div>
      </div>
    </FondAntenne>
  );
}

/**
 * La transition entre deux sujets : un volet bleu traverse l'image, précédé
 * d'un liseré clair, le mot passe, et le volet poursuit sa course.
 */
export function Transition({ overlay, durationInFrames }) {
  const { frame, k } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const mot = champ(overlay, 'titre');
  const fin = Number.isFinite(durationInFrames) && durationInFrames > 0 ? durationInFrames : 45 * k;
  const entre = poser(frame / (12 * k));
  const sort = quitter((frame - (fin - 12 * k)) / (12 * k));
  // Le volet entre par la gauche et sort par la droite : il traverse.
  const cache = `inset(0 ${((1 - entre) * 100).toFixed(2)}% 0 ${(sort * 100).toFixed(2)}%)`;
  const lisere = `inset(0 ${(Math.max(0, 1 - entre * 1.08) * 100).toFixed(2)}% 0 ${(Math.min(1, sort * 1.08) * 100).toFixed(2)}%)`;
  const texte = poser((frame - 7 * k) / (12 * k)) * (1 - quitter((frame - (fin - 16 * k)) / (8 * k)));
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: POLICE_HABILLAGE, ...varPolice(overlay) }}>
      <div style={{ position: 'absolute', inset: 0, background: T.accent, clipPath: lisere, WebkitClipPath: lisere }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(165deg, ${T.profond}, ${T.fond})`, clipPath: cache, WebkitClipPath: cache, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {mot && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Monte p={texte}>
              <TexteJT role="titrage" delai={7} style={{ ...titrage, fontSize: taille(overlay, 150), letterSpacing: '0.08em', color: T.texte }}>{mot}</TexteJT>
            </Monte>
            <Filet p={texte} epaisseur={6} longueur={260} couleur={T.accent} origine="center" style={{ marginTop: 18 }} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Le flash : une bande sur toute la largeur, au bas de l'image, qui ne se rate pas. */
export function Flash({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames, 'franc');
  const T = teintes(overlay);
  const tag = champ(overlay, 'titre') || 'FLASH INFO';
  const info = champ(overlay, 'texte');
  const battement = 0.45 + 0.55 * Math.abs(Math.cos((frame / (30 * k)) * Math.PI));
  return (
    <Cadre overlay={overlay} ancre="bas" style={{ bottom: 70 }}>
      <Filet p={p(0, 16)} epaisseur={6} couleur={T.alerte} />
      <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 132 }}>
        <Volet p={p(2, 12)} style={{ background: T.alerte, padding: `0 44px 0 ${MARGE}px`, display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: T.papier, opacity: battement }} />
          <TexteJT role="titrage" delai={3} style={{ ...titrage, fontSize: taille(overlay, 52), letterSpacing: '0.05em', color: T.papier }}>{tag}</TexteJT>
        </Volet>
        <Volet p={p(5, 18)} style={{ position: 'relative', flex: 1, background: T.papier, padding: `0 ${MARGE}px 0 40px`, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <Monte p={p(9, 15)}>
            <TexteJT role="titrage" delai={9} style={{ ...titrage, fontSize: taille(overlay, 62), color: T.encre }}>{info}</TexteJT>
          </Monte>
          <Reflet frame={frame} k={k} debut={18} duree={28} />
        </Volet>
      </div>
    </Cadre>
  );
}

/** La dernière minute, plein écran : un bloc rouge s'ouvre, l'information suit. */
export function DerniereMinute({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames, 'franc');
  const T = teintes(overlay);
  const tag = champ(overlay, 'titre') || 'DERNIÈRE MINUTE';
  const info = champ(overlay, 'texte');
  const battement = 0.45 + 0.55 * Math.abs(Math.cos((frame / (30 * k)) * Math.PI));
  return (
    <FondAntenne p={p(0, 12)} frame={frame} k={k} T={T} teinte={COULEURS.fondAlerte}>
      <div style={{ position: 'absolute', inset: 0, padding: `0 ${MARGE * 1.5}px`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', fontFamily: POLICE_HABILLAGE, ...varPolice(overlay) }}>
        <Volet p={p(4, 16)} style={{ position: 'relative', background: T.alerte, padding: '22px 56px 18px 44px', display: 'flex', alignItems: 'center', gap: 28, overflow: 'hidden' }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: T.papier, opacity: battement, flexShrink: 0 }} />
          <Monte p={p(8, 16)}>
            <TexteJT role="titrage" delai={8} style={{ ...titrage, fontSize: taille(overlay, 150), color: T.papier }}>{tag}</TexteJT>
          </Monte>
          <Reflet frame={frame} k={k} debut={18} duree={26} />
        </Volet>
        <Filet p={p(12, 22)} epaisseur={6} couleur={T.papier} style={{ margin: '38px 0 30px', opacity: 0.85 }} />
        {info && (
          <Monte p={p(15, 18)}>
            <TexteJT role="titrage" delai={15} style={{ ...titrage, textTransform: 'none', whiteSpace: 'normal', fontSize: taille(overlay, 84), lineHeight: 1.1, color: T.texte }}>{info}</TexteJT>
          </Monte>
        )}
      </div>
    </FondAntenne>
  );
}

/**
 * Les titres.
 *
 * LE CONSTAT : les titres s'affichaient en liste numérotée, 01, 02, 03 —
 * une liste de courses. À l'antenne, les titres sont le moment le plus tendu
 * du journal : chaque information prend TOUT l'écran, seule, en très grand,
 * puis cède la place à la suivante.
 *
 * Ici chaque titre a sa scène :
 *   - ses mots montent un à un derrière un cache, en capitales ;
 *   - un trait d'accent se dresse à sa gauche, une barre segmentée en bas dit
 *     où l'on en est et se remplit pendant qu'il est à l'écran ;
 *   - au changement, le titre sort par le haut, un éclat traverse l'image, et
 *     le décor avance d'un cran : on sent qu'on passe à autre chose.
 * L'étiquette « LES TITRES » et le compteur restent posés, discrets.
 *
 * Le temps est partagé également entre les titres ; le dernier reste jusqu'à
 * la fin.
 */
export function RappelTitres({ overlay, durationInFrames }) {
  const { frame, k, p, depart } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const entete = champ(overlay, 'titre') || 'LES TITRES';
  const titres = ['titre1', 'titre2', 'titre3', 'titre4', 'titre5'].map((c) => champ(overlay, c)).filter(Boolean);
  if (!titres.length) return null;

  const t = frame / k;
  const OUVERTURE = 12; // l'étiquette et le décor s'installent d'abord
  const fin = Number.isFinite(durationInFrames) && durationInFrames > 0 ? durationInFrames / k : OUVERTURE + titres.length * 78;
  const scene = Math.max(36, (fin - OUVERTURE - 8) / titres.length);
  const rang = Math.max(0, Math.min(titres.length - 1, Math.floor((t - OUVERTURE) / scene)));
  const local = t - OUVERTURE - rang * scene; // images écoulées dans la scène en cours
  const dernier = rang === titres.length - 1;
  // Chaque titre sort dans ses huit dernières images, sauf le dernier, qui
  // reste jusqu'à la sortie d'ensemble.
  const sortie = dernier ? 0 : quitter((local - (scene - 8)) / 8);
  const entree = (delai, duree = 13) => poser((local - delai) / duree) * (1 - depart);
  // Le décor avance d'un cran à chaque titre, d'un geste qui se pose.
  const avance = rang + (rang > 0 || t > OUVERTURE ? poser(local / 16) : 0) - 1;
  const eclat = local / 11;
  const mots = titres[rang].split(/\s+/);
  // Un titre long descend d'un corps : il doit tenir en trois lignes au plus.
  const corps = Math.round((titres[rang].length > 46 ? 132 : titres[rang].length > 28 ? 164 : 196) * ((Number(overlay.fontSize) || 100) / 100));

  return (
    <FondAntenne p={p(0, 14)} frame={frame} k={k} T={T} avance={Math.max(0, avance)}>
      <div style={{ position: 'absolute', inset: 0, padding: `${MARGE}px ${MARGE * 1.4}px`, display: 'flex', flexDirection: 'column', fontFamily: POLICE_HABILLAGE, ...varPolice(overlay) }}>
        {/* L'étiquette et le compteur : posés une fois, ils ne bougent plus. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Volet p={p(2, 12)} style={{ background: T.accent, padding: '13px 26px 12px' }}>
            <Monte p={p(5, 12)}>
              <div style={{ ...mention, fontSize: taille(overlay, 42), letterSpacing: '0.14em', color: T.profond }}>{entete}</div>
            </Monte>
          </Volet>
          <div style={{ ...titrage, fontSize: taille(overlay, 52), color: T.texte, opacity: p(8, 14) * 0.9, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.08em' }}>
            <span style={{ color: T.accent }}>{rang + 1}</span><span style={{ opacity: 0.55 }}> / {titres.length}</span>
          </div>
        </div>

        {/* La scène du titre en cours. */}
        <div key={rang} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 44 }}>
          <Filet vertical p={entree(0, 10) * (1 - sortie)} epaisseur={14} longueur={Math.min(520, corps + mots.length * 34)} couleur={T.accent} origine="center" />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'center', columnGap: Math.round(corps * 0.24), rowGap: 2, maxWidth: 1560 }}>
            {mots.map((mot, i) => {
              // Les mots montent un à un ; à la sortie, ils repartent ensemble par le haut.
              const pose = entree(3 + i * 1.6);
              return (
                <span key={`${rang}-${i}`} style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: 6 }}>
                  <span style={{ ...titrage, display: 'inline-block', fontSize: corps, lineHeight: 1.0, color: T.texte, transform: `translateY(${((1 - pose) * 108 - sortie * 112).toFixed(2)}%)` }}>{mot}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* La barre segmentée : où l'on en est, et le temps qui reste à ce titre. */}
        <div style={{ display: 'flex', gap: 14, opacity: p(8, 14) }}>
          {titres.map((_, i) => {
            const rempli = i < rang ? 1 : i === rang ? Math.min(1, local / (dernier ? scene : scene - 4)) : 0;
            return (
              <div key={i} style={{ flex: 1, height: 10, background: T.papier, opacity: i > rang ? 0.22 : 1, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: i <= rang ? T.accent : 'transparent', transform: `scaleX(${rempli.toFixed(4)})`, transformOrigin: 'left' }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* L'éclat qui traverse l'image à chaque changement de titre. */}
      {t > OUVERTURE && eclat > 0 && eclat < 1 && (
        <div style={{ position: 'absolute', top: '-20%', height: '140%', width: '22%', left: `${(-26 + eclat * 150).toFixed(2)}%`, transform: 'skewX(-18deg)', background: VOILES.reflet, opacity: 0.9 }} />
      )}
    </FondAntenne>
  );
}

/** L'écran de fin : le mot de la fin, un filet, le rendez-vous, puis le logo. */
export function Fin({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const titre = champ(overlay, 'titre', 'texte') || 'Merci de votre fidélité';
  const sous = champ(overlay, 'sous_titre');
  return (
    <FondAntenne p={p(0, 16)} frame={frame} k={k} T={T}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: POLICE_HABILLAGE, ...varPolice(overlay) }}>
        <Monte p={p(6, 18)}>
          <TexteJT role="titrage" delai={6} style={{ ...titrage, textTransform: 'none', fontSize: taille(overlay, 124), color: T.texte }}>{titre}</TexteJT>
        </Monte>
        <Filet p={p(12, 22)} epaisseur={6} longueur={360} couleur={T.accent} origine="center" style={{ margin: '34px 0 30px' }} />
        {sous && (
          <Monte p={p(16, 16)}>
            <TexteJT role="courant" delai={16} style={{ ...mention, fontSize: taille(overlay, 36), color: T.accent }}>{sous}</TexteJT>
          </Monte>
        )}
        <Img src={staticFile('images/alwm-logo-sombre.png')} style={{ width: 280, objectFit: 'contain', marginTop: 64, opacity: p(24, 18), transform: `translateY(${((1 - p(24, 22)) * 18).toFixed(2)}px)` }} />
      </div>
    </FondAntenne>
  );
}

/** Le grand titre, sur l'image : deux lignes, chacune sur son bloc, qui s'ouvrent en décalé. */
export function GrandTitre({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const mots = champ(overlay, 'titre', 'line1').split(/\s+/).filter(Boolean);
  // Deux lignes équilibrées : la coupe tombe au plus près du milieu.
  const milieu = mots.join(' ').length / 2;
  let coupe = mots.length; let cumul = 0;
  for (let i = 0; i < mots.length; i += 1) { cumul += mots[i].length + 1; if (cumul >= milieu) { coupe = i + 1; break; } }
  const lignes = mots.length > 2 ? [mots.slice(0, coupe).join(' '), mots.slice(coupe).join(' ')].filter(Boolean) : [mots.join(' ')];
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, opacity: p(0, 16), background: VOILES.centre }} />
      <Cadre overlay={overlay} ancre="plein">
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {lignes.map((ligne, i) => (
            <Volet key={i} p={p(2 + i * 5, 16)} depuis={i % 2 ? 'droite' : 'gauche'} style={{ position: 'relative', background: i % 2 ? T.papier : T.fond, padding: '18px 56px 14px', overflow: 'hidden', filter: `drop-shadow(${assise})` }}>
              <Monte p={p(6 + i * 5, 16)}>
                <TexteJT role="titrage" delai={6 + i * 5} style={{ ...titrage, fontSize: taille(overlay, 150), color: i % 2 ? T.encre : T.texte }}>{ligne}</TexteJT>
              </Monte>
              <Reflet frame={frame} k={k} debut={16 + i * 5} />
            </Volet>
          ))}
          <Filet p={p(14, 22)} epaisseur={8} longueur={300} couleur={T.accent} origine="center" style={{ marginTop: 22 }} />
        </div>
      </Cadre>
    </>
  );
}

/** Le duplex : un trait partage l'image, chaque côté porte son lieu. */
export function Duplex({ overlay, durationInFrames }) {
  const { p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const cote = (lieu, pays, aDroite) => (lieu || pays) && (
    <div style={{ position: 'absolute', bottom: MARGE, [aDroite ? 'right' : 'left']: MARGE, display: 'flex', flexDirection: 'column', alignItems: aDroite ? 'flex-end' : 'flex-start', filter: `drop-shadow(${assise})` }}>
      <Volet p={p(6, 14)} depuis={aDroite ? 'droite' : 'gauche'} style={{ background: T.fond, padding: '14px 36px 12px' }}>
        <Monte p={p(9, 14)}>
          <TexteJT role="titrage" delai={9} style={{ ...titrage, fontSize: taille(overlay, 58), color: T.texte }}>{lieu}</TexteJT>
        </Monte>
      </Volet>
      {pays && (
        <Volet p={p(11, 12)} depuis="haut" style={{ background: T.papier, padding: '9px 36px 10px' }}>
          <TexteJT role="courant" delai={12} style={{ ...mention, fontSize: taille(overlay, 24), color: T.encre }}>{pays}</TexteJT>
        </Volet>
      )}
    </div>
  );
  return (
    <Cadre overlay={overlay} ancre="plein">
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, marginLeft: -4, display: 'flex' }}>
        <Filet vertical p={p(0, 20)} epaisseur={8} couleur={T.accent} origine="center" />
      </div>
      {cote(champ(overlay, 'leftLocation'), champ(overlay, 'leftSub'), false)}
      {cote(champ(overlay, 'rightLocation'), champ(overlay, 'rightSub'), true)}
    </Cadre>
  );
}

/** Le bandeau défilant : une mention fixe, et les informations qui passent. */
export function Defilant({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const f = overlay.fields || {};
  const tag = champ(overlay, 'tag');
  const infos = (Array.isArray(f.items) ? f.items : [f.text1, f.text2]).map((x) => String(x || '').trim()).filter(Boolean);
  if (!infos.length) return null;
  // Une largeur estimée suffit : la bande est répétée, la boucle ne se voit pas.
  const ligne = infos.join('   •   ');
  const largeur = Math.max(900, ligne.length * 21 + 140);
  const decalage = ((frame / k) * 4.2) % largeur;
  return (
    <Cadre overlay={overlay} ancre="bas">
      <Volet p={p(0, 14)} depuis="bas" style={{ display: 'flex', alignItems: 'stretch', height: 84, background: T.profond, borderTop: `4px solid ${T.accent}` }}>
        {tag && (
          <div style={{ background: T.accent, padding: `0 34px 0 ${MARGE}px`, display: 'flex', alignItems: 'center', flexShrink: 0, zIndex: 1 }}>
            <span style={{ ...mention, fontSize: taille(overlay, 30), color: T.profond }}>{tag}</span>
          </div>
        )}
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', transform: `translateX(${(-decalage).toFixed(2)}px)`, whiteSpace: 'nowrap' }}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ ...courant, fontSize: taille(overlay, 34), color: T.texte, width: largeur, flexShrink: 0, paddingLeft: 40 }}>{ligne}<span style={{ color: T.accent }}>   •</span></span>
            ))}
          </div>
        </div>
      </Volet>
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* Informer : un chiffre, les points à retenir, ce qui suit            */
/* ------------------------------------------------------------------ */

/**
 * Lit « 72 % », « 1 250 000 FCFA », « 3,4 millions » : ce qui précède le
 * nombre, le nombre, ce qui le suit — et la façon dont il était écrit, pour
 * le réécrire pareil pendant qu'il se compte.
 */
export function lireChiffre(texte) {
  const m = /^([^\d-]*)(-?\d[\d\s.,]*)(.*)$/.exec(String(texte || '').trim());
  if (!m) return null;
  const brut = m[2].trim();
  const virgule = /,\d{1,2}$/.test(brut);
  const decimales = (/[.,](\d{1,2})$/.exec(brut) || [])[1];
  const valeur = Number(brut.replace(/\s/g, '').replace(virgule ? /\./g : /,/g, '').replace(',', '.'));
  if (!Number.isFinite(valeur)) return null;
  // L'espace qui sépare le nombre de son unité (« 72 % ») appartient à l'unité.
  const apres = (/\s+$/.exec(m[2]) || [''])[0] + m[3];
  return { avant: m[1], apres, valeur, decimales: decimales ? decimales.length : 0, virgule, espaces: /\d\s\d/.test(brut) };
}

/** Le nombre tel qu'il s'affiche à `part` (0 → 1) de son décompte. */
export function ecrireChiffre(chiffre, part) {
  const n = (chiffre.valeur * Math.max(0, Math.min(1, part))).toFixed(chiffre.decimales);
  let [entier, reste] = n.split('.');
  if (chiffre.espaces) entier = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${chiffre.avant}${entier}${reste ? `${chiffre.virgule ? ',' : '.'}${reste}` : ''}${chiffre.apres}`;
}

/**
 * Le chiffre clé : le nombre se compte à l'écran, très grand, puis sa légende
 * et sa source se posent dessous.
 */
export function ChiffreCle({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames, 'doux');
  const T = teintes(overlay);
  const saisi = champ(overlay, 'chiffre');
  const legende = champ(overlay, 'legende');
  const source = champ(overlay, 'source');
  const chiffre = lireChiffre(saisi);
  // Le décompte dure un peu moins d'une seconde et se pose, comme le reste.
  const affiche = chiffre ? ecrireChiffre(chiffre, poser((frame / k - 6) / 26)) : saisi;
  return (
    <Cadre overlay={overlay}>
      <div style={{ display: 'flex', alignItems: 'stretch', filter: `drop-shadow(${assise})` }}>
        <Filet vertical p={p(0, 10)} epaisseur={14} couleur={T.accent} />
        <Volet p={p(2, 16)} style={{ position: 'relative', background: T.fond, padding: '26px 60px 26px 40px', overflow: 'hidden', minWidth: 460 }}>
          <Monte p={p(5, 14)}>
            <div style={{ ...titrage, fontSize: taille(overlay, 210), lineHeight: 0.95, color: T.texte, fontVariantNumeric: 'tabular-nums' }}>{affiche}</div>
          </Monte>
          {legende && (
            <>
              <Filet p={p(12, 18)} epaisseur={5} longueur={140} couleur={T.accent} style={{ margin: '16px 0 14px' }} />
              <Monte p={p(14, 14)}>
                <TexteJT role="courant" delai={14} style={{ ...courant, whiteSpace: 'normal', maxWidth: 760, fontSize: taille(overlay, 44), color: T.texte }}>{legende}</TexteJT>
              </Monte>
            </>
          )}
          {source && (
            <div style={{ ...mention, fontSize: taille(overlay, 22), color: T.accent, marginTop: 16, opacity: p(20, 14) }}>{source}</div>
          )}
          <Reflet frame={frame} k={k} debut={30} duree={26} />
        </Volet>
      </div>
    </Cadre>
  );
}

/** « À suivre » : une mention dont les chevrons avancent, et ce qui vient. */
export function ASuivre({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const tag = champ(overlay, 'mention') || 'À SUIVRE';
  const titre = champ(overlay, 'titre');
  return (
    <Cadre overlay={overlay} ancre="bas-droite">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', filter: `drop-shadow(${assise})` }}>
        <Volet p={p(0, 12)} depuis="droite" style={{ background: T.accent, padding: '12px 22px 11px 26px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ ...mention, fontSize: taille(overlay, 28), letterSpacing: '0.14em', color: T.profond }}>{tag}</span>
          {/* Les chevrons s'allument l'un après l'autre : ils disent « ça vient ». */}
          <span style={{ display: 'flex', gap: 3 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ ...titrage, fontSize: taille(overlay, 30), color: T.profond, opacity: 0.25 + 0.75 * Math.max(0, Math.sin(((frame / k) / 24 - i / 5) * Math.PI * 2)) }}>›</span>
            ))}
          </span>
        </Volet>
        <Volet p={p(4, 16)} depuis="droite" style={{ position: 'relative', background: T.fond, padding: '18px 34px 16px 40px', overflow: 'hidden' }}>
          <Monte p={p(8, 14)}>
            <TexteJT role="titrage" delai={8} style={{ ...titrage, fontSize: taille(overlay, 58), color: T.texte }}>{titre}</TexteJT>
          </Monte>
          <Reflet frame={frame} k={k} debut={18} />
        </Volet>
      </div>
    </Cadre>
  );
}

/**
 * L'essentiel : un panneau à droite de l'image, dont les points arrivent l'un
 * après l'autre, chacun précédé d'un trait qui se trace.
 */
export function Essentiel({ overlay, durationInFrames }) {
  const { p } = useCalques(durationInFrames, 'doux');
  const T = teintes(overlay);
  const entete = champ(overlay, 'titre') || 'L’ESSENTIEL';
  const points = ['point1', 'point2', 'point3', 'point4'].map((c) => champ(overlay, c)).filter(Boolean);
  return (
    <Cadre overlay={overlay} ancre="plein">
      <Volet p={p(0, 18)} depuis="droite" style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 700, background: VOILES.panneau, borderLeft: `8px solid ${T.accent}`, padding: `${MARGE}px 56px ${MARGE}px 52px`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Monte p={p(6, 14)}>
          <div style={{ ...mention, fontSize: taille(overlay, 40), letterSpacing: '0.14em', color: T.accent }}>{entete}</div>
        </Monte>
        <Filet p={p(9, 20)} epaisseur={4} couleur={T.papier} style={{ margin: '22px 0 34px', opacity: 0.4 }} />
        {points.map((point, i) => {
          const d = 14 + i * 9;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 22, marginBottom: 30 }}>
              <Filet p={p(d, 10)} epaisseur={8} longueur={34} couleur={T.accent} style={{ marginTop: 20 }} />
              <Monte p={p(d + 2, 14)} style={{ flex: 1 }}>
                <TexteJT role="courant" delai={d + 2} style={{ ...courant, whiteSpace: 'normal', fontSize: taille(overlay, 40), lineHeight: 1.2, color: T.texte }}>{point}</TexteJT>
              </Monte>
            </div>
          );
        })}
      </Volet>
    </Cadre>
  );
}

/**
 * L'ouverture de rubrique : le mot en très grand, et derrière lui le même mot
 * en contour, immense, qui glisse lentement — la typographie fait le décor.
 */
export function Rubrique({ overlay, durationInFrames }) {
  const { frame, k, p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const mot = champ(overlay, 'titre');
  const sous = champ(overlay, 'sous_titre');
  const glisse = (frame / k) * 1.6;
  return (
    <FondAntenne p={p(0, 12)} frame={frame} k={k} T={T}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: POLICE_HABILLAGE, ...varPolice(overlay) }}>
        {/* Le mot en contour, deux fois, à contresens. */}
        {[[-8, -1], [54, 1]].map(([haut, sens], i) => (
          <div key={i} style={{ position: 'absolute', top: `${haut}%`, left: 0, whiteSpace: 'nowrap', transform: `translateX(${(sens * glisse - (sens > 0 ? 700 : 100)).toFixed(1)}px)`, opacity: p(4 + i * 4, 24) * 0.2 }}>
            <span style={{ ...titrage, fontSize: 520, lineHeight: 1, color: 'transparent', WebkitTextStroke: `3px ${T.accent}` }}>{`${mot}  ${mot}  ${mot}`}</span>
          </div>
        ))}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Filet p={p(4, 18)} epaisseur={8} longueur={220} couleur={T.accent} origine="center" style={{ marginBottom: 26 }} />
          <Monte p={p(6, 18)}>
            <TexteJT role="titrage" delai={6} style={{ ...titrage, fontSize: taille(overlay, 240), letterSpacing: '0.04em', color: T.texte }}>{mot}</TexteJT>
          </Monte>
          {sous && (
            <Monte p={p(14, 16)} style={{ marginTop: 22 }}>
              <TexteJT role="courant" delai={14} style={{ ...mention, fontSize: taille(overlay, 40), color: T.accent }}>{sous}</TexteJT>
            </Monte>
          )}
        </div>
      </div>
    </FondAntenne>
  );
}

/** La mention d'image : « IMAGES D'ARCHIVES », une date — discrète, dans un coin. */
export function MentionImage({ overlay, durationInFrames }) {
  const { p } = useCalques(durationInFrames);
  const T = teintes(overlay);
  const texte = champ(overlay, 'texte');
  return (
    <Cadre overlay={overlay} ancre="haut-droite">
      <Volet p={p(0, 14)} depuis="droite" style={{ background: VOILES.panneau, borderRight: `6px solid ${T.accent}`, padding: '12px 22px 11px 24px' }}>
        <Monte p={p(4, 12)}>
          <TexteJT role="courant" delai={4} style={{ ...mention, fontSize: taille(overlay, 26), color: T.texte }}>{texte}</TexteJT>
        </Monte>
      </Volet>
    </Cadre>
  );
}
