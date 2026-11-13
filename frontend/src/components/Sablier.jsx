import { useId, useState } from 'react';
import {
  CX,
  CULOT,
  GOULOT_Y,
  H,
  PERSPECTIVE,
  RETRAIT,
  cheminAmpoule,
  cheminVerre,
  etatSablier,
  profil,
} from '../lib/sablier.js';

/**
 * Le sablier du compte à rebours : un objet en verre, en bois et en laiton,
 * dont le sable s'écoule à mesure que la clôture approche.
 *
 * - Le sable passe d'une ampoule à l'autre en VOLUME (lib/sablier.js) : dans
 *   la panse, le niveau bouge à peine ; près du goulot, il file.
 * - Sa couleur est celle de la phase (`--cr-couleur`, posée par `.cr`) :
 *   vert, orange, rouge — la logique de l'ancienne jauge, inchangée.
 * - Ce qui bouge dit quelque chose : le filet coule (le temps passe), de plus
 *   en plus vite à l'approche de la clôture ; un reflet traverse le verre à
 *   chaque minute, calé sur l'horloge. Une fois clos, plus rien ne coule.
 *
 * `mini` : la version de 36 px de la carte compacte — mêmes volumes, sans les
 * détails qu'on ne verrait pas à cette taille.
 *
 * Purement décoratif pour un lecteur d'écran : le minuteur parent porte la
 * phrase complète (role="timer").
 */

const VERRE = cheminVerre();
const SABLE_HAUT = cheminAmpoule(true, RETRAIT);
const SABLE_BAS = cheminAmpoule(false, RETRAIT);

/** Un trait qui suit la paroi, à `ecart` du verre : reflets et liserés. */
function longeParoi(versLeHaut, cote, ecart, t0, t1, pas = 18) {
  const points = [];
  for (let i = 0; i <= pas; i += 1) {
    const t = t0 + ((t1 - t0) * i) / pas;
    const x = CX + cote * (profil(t) - ecart);
    const y = GOULOT_Y + (versLeHaut ? -1 : 1) * t * H;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M ${points.join(' L ')}`;
}

const REFLET_HAUT = longeParoi(true, -1, 7, 0.24, 0.84);
const REFLET_BAS = longeParoi(false, -1, 7, 0.26, 0.84);
const LISERE_HAUT = longeParoi(true, 1, 3, 0.3, 0.8);
const LISERE_BAS = longeParoi(false, 1, 3, 0.3, 0.8);

// Le cadre : deux plateaux, deux colonnes tournées, deux bagues de laiton.
const PLATEAU = { rx: 69, epaisseur: 12 };
const Y_CHAPEAU = 14;
const Y_SOCLE = 216;
const ry = (rx) => rx * PERSPECTIVE;

/** La face avant d'un disque vu d'un peu au-dessus. */
function flanc(cy, rx, epaisseur) {
  const g = CX - rx;
  const d = CX + rx;
  return `M ${g},${cy} L ${g},${cy + epaisseur} A ${rx} ${ry(rx)} 0 0 0 ${d},${cy + epaisseur} L ${d},${cy} A ${rx} ${ry(rx)} 0 0 1 ${g},${cy} Z`;
}

/** Le cône de sable du bas, posé sur son bord, arrondi au sommet. */
function cheminTas({ yBord, ySommet, demiLargeur: w }) {
  const montee = yBord - ySommet;
  return [
    `M ${CX - w},${yBord}`,
    `C ${CX - w * 0.5},${yBord - montee * 0.18} ${CX - w * 0.2},${ySommet} ${CX},${ySommet}`,
    `C ${CX + w * 0.2},${ySommet} ${CX + w * 0.5},${yBord - montee * 0.18} ${CX + w},${yBord}`,
    `A ${w} ${ry(w)} 0 0 1 ${CX - w},${yBord}`,
    'Z',
  ].join(' ');
}

/** Une colonne tournée : un fût et trois bagues. */
function Colonne({ x }) {
  return (
    <g>
      <rect x={x - 3.5} y={Y_CHAPEAU + 8} width={7} height={Y_SOCLE - Y_CHAPEAU - 8} />
      <rect x={x - 5} y={32} width={10} height={6} rx={3} />
      <rect x={x - 4.6} y={GOULOT_Y - 4} width={9.2} height={8} rx={4} />
      <rect x={x - 5} y={Y_SOCLE - 14} width={10} height={6} rx={3} />
    </g>
  );
}

export default function Sablier({ fraction, mini = false, className = '', children }) {
  const id = useId().replace(/:/g, '');
  // Le reflet passe à chaque minute pile : calé une fois, à l'affichage.
  const [departMinute] = useState(() => -new Date().getSeconds());
  const e = etatSablier(fraction);
  const ref = (nom) => `url(#${id}-${nom})`;
  const idDe = (nom) => `${id}-${nom}`;
  const avecDetails = !mini;

  const sableHaut = e.surfaceHaut && (
    <>
      <rect x="0" y={e.surfaceHaut.y} width="160" height={GOULOT_Y + 1 - e.surfaceHaut.y} />
      <ellipse cx={CX} cy={e.surfaceHaut.y} rx={e.surfaceHaut.demiLargeur} ry={ry(e.surfaceHaut.demiLargeur)} />
    </>
  );
  const sableBas = e.tas && (
    <>
      <rect x="0" y={e.tas.yBord} width="160" height={CULOT + 2 - e.tas.yBord} />
      <path d={cheminTas(e.tas)} />
    </>
  );

  return (
    <div className={`cr-sablier ${className}`} data-coule={e.coule ? 1 : 0}>
      <span className="cr-halo" />
      <svg viewBox="0 0 160 246" focusable="false" aria-hidden="true">
        <defs>
          <clipPath id={idDe('clip-haut')}><path d={SABLE_HAUT} /></clipPath>
          <clipPath id={idDe('clip-bas')}><path d={SABLE_BAS} /></clipPath>
          <clipPath id={idDe('clip-verre')}><path d={VERRE} /></clipPath>

          <linearGradient id={idDe('sable')} gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="130" y2="0">
            <stop offset="0" className="cr-sablier-sable-bord" />
            <stop offset="0.3" className="cr-sablier-sable-lumiere" />
            <stop offset="0.58" className="cr-sablier-sable-coeur" />
            <stop offset="1" className="cr-sablier-sable-bord" />
          </linearGradient>
          <linearGradient id={idDe('surface')} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" className="cr-sablier-surface-fond" />
            <stop offset="1" className="cr-sablier-surface-claire" />
          </linearGradient>
          <radialGradient id={idDe('creux')}>
            <stop offset="0" className="cr-sablier-creux-centre" />
            <stop offset="1" className="cr-sablier-creux-bord" />
          </radialGradient>
          <linearGradient id={idDe('tas')} x1="0" y1="0" x2="1" y2="0.7">
            <stop offset="0" className="cr-sablier-surface-claire" />
            <stop offset="0.5" className="cr-sablier-sable-coeur" />
            <stop offset="1" className="cr-sablier-sable-bord" />
          </linearGradient>
          {avecDetails && (
            // Le grain du sable : quelques points clairs et sombres, semés
            // irrégulièrement sur une tuile assez grande pour que l'œil n'y
            // lise pas une trame.
            <pattern id={idDe('grain')} width="11" height="9" patternUnits="userSpaceOnUse">
              <circle cx="1.2" cy="1.4" r="0.42" fill="#000" fillOpacity="0.11" />
              <circle cx="6.3" cy="0.8" r="0.34" fill="#fff" fillOpacity="0.2" />
              <circle cx="9.1" cy="3.3" r="0.4" fill="#000" fillOpacity="0.09" />
              <circle cx="3.7" cy="4.2" r="0.36" fill="#fff" fillOpacity="0.22" />
              <circle cx="7.6" cy="6.4" r="0.3" fill="#000" fillOpacity="0.1" />
              <circle cx="1.9" cy="7.6" r="0.33" fill="#fff" fillOpacity="0.16" />
              <circle cx="10.2" cy="8.1" r="0.28" fill="#fff" fillOpacity="0.14" />
              <circle cx="5" cy="8.3" r="0.38" fill="#000" fillOpacity="0.08" />
            </pattern>
          )}

          <linearGradient id={idDe('verre-fond')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#c9d6e2" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="#f4f8fb" stopOpacity="0.35" />
            <stop offset="1" stopColor="#c3d0dc" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id={idDe('verre-face')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5b7184" stopOpacity="0.34" />
            <stop offset="0.16" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.86" stopColor="#5b7184" stopOpacity="0.1" />
            <stop offset="1" stopColor="#3f5466" stopOpacity="0.38" />
          </linearGradient>
          <linearGradient id={idDe('reflet')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.3" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="0.7" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={idDe('balayage')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>

          {/* Le bois : un noyer sombre, éclairé d'en haut à gauche. */}
          <linearGradient id={idDe('bois-flanc')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2e1b10" />
            <stop offset="0.2" stopColor="#6b4429" />
            <stop offset="0.34" stopColor="#a4734b" />
            <stop offset="0.55" stopColor="#7a4f31" />
            <stop offset="0.88" stopColor="#4a2d1b" />
            <stop offset="1" stopColor="#24150c" />
          </linearGradient>
          <linearGradient id={idDe('bois-dessus')} x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0" stopColor="#5a3822" />
            <stop offset="1" stopColor="#9a6a45" />
          </linearGradient>
          <linearGradient id={idDe('bois-colonne')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2a180e" />
            <stop offset="0.32" stopColor="#b07c52" />
            <stop offset="0.6" stopColor="#6b4429" />
            <stop offset="1" stopColor="#24150c" />
          </linearGradient>
          <linearGradient id={idDe('laiton')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#6a4c1c" />
            <stop offset="0.28" stopColor="#d6b060" />
            <stop offset="0.4" stopColor="#f6e3a6" />
            <stop offset="0.7" stopColor="#b58a3a" />
            <stop offset="1" stopColor="#5e4318" />
          </linearGradient>
          <radialGradient id={idDe('ombre')}>
            <stop offset="0" stopColor="#1b2330" stopOpacity="0.32" />
            <stop offset="1" stopColor="#1b2330" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* L'ombre portée sur la page. */}
        <ellipse cx={CX} cy="237" rx="76" ry="8" fill={ref('ombre')} />

        {/* Le socle. */}
        <path d={flanc(Y_SOCLE, PLATEAU.rx + 1, PLATEAU.epaisseur + 1)} fill={ref('bois-flanc')} />
        <ellipse cx={CX} cy={Y_SOCLE} rx={PLATEAU.rx + 1} ry={ry(PLATEAU.rx + 1)} fill={ref('bois-dessus')} />
        <ellipse cx={CX} cy={Y_SOCLE} rx={PLATEAU.rx - 4} ry={ry(PLATEAU.rx - 4)} fill="none" stroke="#c8935f" strokeOpacity="0.35" strokeWidth="0.8" />

        {/* Le verre, côté fond : il teinte légèrement ce qu'on voit à travers. */}
        <path d={VERRE} fill={ref('verre-fond')} />

        {/* Le sable. Les deux tracés sont repris par le grain, en surimpression. */}
        <g clipPath={ref('clip-bas')}>
          <g fill={ref('sable')}>{sableBas}</g>
          {e.tas && (
            <>
              <ellipse cx={CX} cy={e.tas.yBord} rx={e.tas.demiLargeur} ry={ry(e.tas.demiLargeur)} fill={ref('surface')} />
              <path className="cr-sablier-tas" d={cheminTas(e.tas)} fill={ref('tas')} />
            </>
          )}
          {avecDetails && <g fill={ref('grain')}>{sableBas}</g>}
        </g>
        <g clipPath={ref('clip-haut')}>
          <g fill={ref('sable')}>{sableHaut}</g>
          {e.surfaceHaut && (
            <>
              <ellipse
                className="cr-sablier-surface"
                cx={CX}
                cy={e.surfaceHaut.y}
                rx={e.surfaceHaut.demiLargeur}
                ry={ry(e.surfaceHaut.demiLargeur)}
                fill={ref('surface')}
              />
              {/* L'entonnoir : la surface se creuse au-dessus du goulot. */}
              <ellipse
                cx={CX}
                cy={e.surfaceHaut.y + 0.4}
                rx={Math.min(e.surfaceHaut.demiLargeur * 0.45, 12)}
                ry={Math.min(e.surfaceHaut.demiLargeur * 0.45, 12) * 0.32}
                fill={ref('creux')}
              />
            </>
          )}
          {avecDetails && <g fill={ref('grain')}>{sableHaut}</g>}
        </g>

        {/* Le filet : du goulot au sommet du tas. */}
        {e.filet && (
          <g className="cr-sablier-chute">
            <rect className="cr-sablier-goulot" x={CX - 1.1} y={GOULOT_Y - 3} width="2.2" height="3.4" rx="1" />
            <line className="cr-sablier-filet-fond" x1={CX} y1={e.filet.y1} x2={CX} y2={e.filet.y2} />
            <line className="cr-sablier-filet" x1={CX} y1={e.filet.y1} x2={CX} y2={e.filet.y2} />
            {avecDetails && (
              <>
                {[-0.7, 0.6, -0.25, 0.4].map((dx, i) => (
                  <circle
                    key={dx}
                    className="cr-sablier-grain"
                    cx={CX + dx}
                    cy={GOULOT_Y + 1}
                    r="0.8"
                    style={{ '--chute': `${e.filet.y2 - GOULOT_Y - 1}px`, animationDelay: `calc(var(--cr-filet) * ${(i * 0.33).toFixed(2)})` }}
                  />
                ))}
                <ellipse className="cr-sablier-impact" cx={CX} cy={e.filet.y2} rx="3.4" ry="1.1" />
              </>
            )}
          </g>
        )}

        {/* Le verre, côté face : les bords plus sombres, les reflets. */}
        <path d={VERRE} fill={ref('verre-face')} stroke="#2c3e50" strokeOpacity="0.3" strokeWidth="0.9" />
        <g fill="none" strokeLinecap="round" stroke={ref('reflet')}>
          <path d={REFLET_HAUT} strokeWidth={mini ? 5 : 3.4} />
          <path d={REFLET_BAS} strokeWidth={mini ? 5 : 3.4} />
        </g>
        {avecDetails && (
          <>
            <g fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" strokeLinecap="round">
              <path d={LISERE_HAUT} />
              <path d={LISERE_BAS} />
            </g>
            <ellipse cx="50" cy="60" rx="1.8" ry="4.6" transform="rotate(24 50 60)" fill="#fff" fillOpacity="0.85" />
            <ellipse cx="50" cy="150" rx="1.5" ry="3.6" transform="rotate(30 50 150)" fill="#fff" fillOpacity="0.7" />
            <ellipse cx={CX} cy={GOULOT_Y} rx="4.4" ry="1.1" fill="none" stroke="#2c3e50" strokeOpacity="0.28" strokeWidth="0.7" />
            {e.coule && (
              <g clipPath={ref('clip-verre')}>
                <g className="cr-sablier-reflet" style={{ animationDelay: `${departMinute}s` }}>
                  <rect x="-20" y="0" width="30" height="246" transform="skewX(-10)" fill={ref('balayage')} />
                </g>
              </g>
            )}
          </>
        )}

        {/* Les bagues de laiton, qui tiennent le verre. */}
        <path d={flanc(Y_SOCLE - 12, 46, 12)} fill={ref('laiton')} />
        {/* Seul le bord avant de la bague se voit : l'arrière passe derrière le verre. */}
        <path d={`M ${CX - 46},${Y_SOCLE - 12} A 46 ${ry(46)} 0 0 0 ${CX + 46},${Y_SOCLE - 12}`} fill="none" stroke="#f6e3a6" strokeOpacity="0.6" strokeWidth="0.8" />
        <path d={flanc(Y_CHAPEAU + 12, 46, 10)} fill={ref('laiton')} />

        {/* Les colonnes, puis le chapeau qui les coiffe. */}
        <g fill={ref('bois-colonne')}>
          <Colonne x={CX - PLATEAU.rx + 6} />
          <Colonne x={CX + PLATEAU.rx - 6} />
        </g>
        <path d={flanc(Y_CHAPEAU, PLATEAU.rx, PLATEAU.epaisseur)} fill={ref('bois-flanc')} />
        <ellipse cx={CX} cy={Y_CHAPEAU} rx={PLATEAU.rx} ry={ry(PLATEAU.rx)} fill={ref('bois-dessus')} />
        <ellipse cx={CX} cy={Y_CHAPEAU} rx={PLATEAU.rx - 5} ry={ry(PLATEAU.rx - 5)} fill="none" stroke="#c8935f" strokeOpacity="0.4" strokeWidth="0.8" />
      </svg>
      {children && <div className="cr-sablier-badge">{children}</div>}
    </div>
  );
}
