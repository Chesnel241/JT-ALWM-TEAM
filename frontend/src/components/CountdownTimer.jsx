import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Flag, Lock } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import {
  echeanceLocale,
  fuseauNavigateur,
  phaseEcheance,
  cadencePouls,
  decompte,
  rubanSemaine,
} from '../lib/echeance.js';

/**
 * Le compte à rebours de la semaine, en mouvement.
 *
 * Ce qu'il doit faire comprendre d'un coup d'œil, à quelqu'un qui n'est pas à
 * l'aise avec les écrans :
 *
 * - **combien de temps il reste**, en chiffres qui basculent et en arc qui
 *   raccourcit ;
 * - **si c'est grave**, par la couleur : vert au-delà de 48 h, orange
 *   jusqu'à 12 h, rouge en dessous — le halo bat de plus en plus vite dans
 *   la dernière heure (lib/echeance.js) ;
 * - **quand exactement**, dans SON heure : « dimanche 05h30, votre heure
 *   (GMT-3) ». Le serveur donne un instant (`week.cutoffAt`) ; on le lit
 *   dans le fuseau du navigateur. La référence de la rédaction suit, en
 *   petit, pour les échanges au téléphone ;
 * - **où on en est dans la semaine**, par le ruban des sept jours.
 *
 * `compact` : la version en ligne du téléphone, qui garde la couleur, le
 * temps restant et le ruban.
 */
export default function CountdownTimer({ week, compact = false }) {
  const { t, lang } = useI18n();
  const maintenant = useHorloge();
  // La trotteuse est calée une fois, à l'affichage, sur les secondes réelles.
  const [departTrotteuse] = useState(() => -(new Date().getSeconds()));

  if (!week?.cutoffAt) return null;
  const fin = Date.parse(week.cutoffAt);
  if (Number.isNaN(fin)) return null;

  const c = t.countdown;
  const debutParse = week.startDate ? Date.parse(week.startDate) : Number.NaN;
  const debut = Number.isNaN(debutParse) ? fin - 7 * 86400000 : debutParse;
  const restant = fin - maintenant;
  const phase = phaseEcheance(restant);
  const pouls = cadencePouls(restant);
  const { jours, heures, minutes, secondes } = decompte(restant);
  const fuseau = fuseauNavigateur();
  const e = echeanceLocale(week.cutoffAt, { lang, timeZone: fuseau });
  const ruban = rubanSemaine(week.cutoffAt, maintenant, { lang, timeZone: fuseau });
  // Avant le début de la semaine, l'arc est plein ; après la clôture, vide.
  const fraction = restant <= 0 ? 0 : Math.min(1, restant / Math.max(1, fin - debut));

  const reference = e.memeHeureQueRedaction ? c.memeHeure : c.heureRedaction(e.reference);
  const ariaLabel = phase === 'clos'
    ? `${c.lateTitle}. ${c.clotureLe(e.complet)}.`
    : c.annonce(c.restant(jours, heures, minutes), `${c.clotureLe(e.complet)}, ${c.votreHeure(e.fuseau)}`);

  const IconePhase = phase === 'clos' ? Lock : phase === 'urgent' ? AlertTriangle : phase === 'proche' ? Clock : CheckCircle2;
  const deux = (n) => String(n).padStart(2, '0');

  if (compact) {
    const temps = phase === 'clos'
      ? c.finished
      : jours > 0
        ? `${jours}${c.days} ${deux(heures)}${c.hours}`
        : `${deux(heures)}:${deux(minutes)}:${deux(secondes)}`;

    return (
      <div
        className="cr cr-compact"
        data-phase={phase}
        data-pouls={pouls ? 1 : 0}
        style={{ '--cr-pouls': `${pouls || 4}s` }}
        role="timer"
        aria-label={ariaLabel}
      >
        <div className="flex items-center gap-3" aria-hidden="true">
          <Cadran fraction={fraction} taille={52} epaisseur={6} departTrotteuse={departTrotteuse}>
            <IconePhase size={18} className="text-[color:var(--cr-plein)]" />
          </Cadran>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-[color:var(--cr-plein)] leading-tight">
              {c.phases[phase]}
            </p>
            <p className="cr-compact-temps mt-0.5">{temps}</p>
          </div>
        </div>
        <p className="text-xs font-semibold text-[color:var(--ink)] leading-snug" aria-hidden="true">
          {c.clotureLe(e.court)}
          <span className="text-[color:var(--muted)] font-medium"> · {c.votreHeure(e.fuseau)}</span>
        </p>
        <Ruban jours={ruban} aujourdhui={c.aujourdhui} afficherIci={false} />
      </div>
    );
  }

  return (
    <section
      id="tour-countdown"
      className="cr cr-carte p-5 sm:p-7 mb-6 sm:mb-8"
      data-phase={phase}
      data-pouls={pouls ? 1 : 0}
      style={{ '--cr-pouls': `${pouls || 4}s` }}
      role="timer"
      aria-label={ariaLabel}
    >
      <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8" aria-hidden="true">
        <Cadran fraction={fraction} taille={148} epaisseur={12} departTrotteuse={departTrotteuse}>
          {phase === 'clos' ? (
            <>
              <Lock size={28} className="text-[color:var(--cr-plein)]" />
              <span className="mt-1.5 text-sm font-black text-[color:var(--cr-plein)]">{c.finished}</span>
            </>
          ) : jours > 0 ? (
            <>
              <span className="text-5xl font-black tabular-nums text-[color:var(--ink)]">{jours}</span>
              <span className="mt-1 text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">{c.unites.jours}</span>
            </>
          ) : (
            <>
              <span className="text-3xl font-black tabular-nums text-[color:var(--ink)]">{deux(heures)}:{deux(minutes)}</span>
              <span className="mt-1 text-xs font-bold tracking-wider text-[color:var(--muted)]">{c.unites.heuresMinutes}</span>
            </>
          )}
        </Cadran>

        <div className="flex-1 min-w-0 w-full text-center sm:text-left space-y-3">
          <span className="cr-phase">
            <IconePhase size={16} />
            {phase === 'clos' ? c.lateTitle : c.phases[phase]}
          </span>

          {phase === 'clos' ? (
            <p className="text-base font-medium text-[color:var(--ink)]">
              {c.lateDesc}
            </p>
          ) : (
            <div className="cr-chiffres justify-center sm:justify-start">
              <Bloc valeur={jours} unite={c.unites.jours} />
              <Bloc valeur={heures} unite={c.unites.heures} />
              <Bloc valeur={minutes} unite={c.unites.minutes} />
              <Bloc valeur={secondes} unite={c.unites.secondes} />
            </div>
          )}

          <div>
            <p className="text-lg sm:text-xl font-extrabold text-[color:var(--ink)] leading-snug">
              {c.clotureLe(e.complet)}
            </p>
            <p className="mt-0.5 text-sm text-[color:var(--muted)]">
              <strong className="text-[color:var(--cr-plein)]">{c.votreHeure(e.fuseau)}</strong>
              {' · '}
              {reference}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6" aria-hidden="true">
        {/* La marge laisse la place à l'étiquette « Aujourd'hui », qui flotte
            au-dessus du jour en cours ; sans jour en cours, elle n'a pas lieu. */}
        <p className={`${ruban.some((j) => j.etat === 'aujourdhui') ? 'mb-6' : 'mb-2'} text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]`}>{c.ruban}</p>
        <Ruban jours={ruban} aujourdhui={c.aujourdhui} afficherIci />
      </div>
    </section>
  );
}

/** L'heure, rafraîchie chaque seconde. */
function useHorloge() {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return maintenant;
}

/** L'anneau : piste, arc du temps restant, trotteuse, halo qui respire. */
function Cadran({ fraction, taille, epaisseur, departTrotteuse, children }) {
  const r = 50 - epaisseur / 2 - 2;
  const circonference = 2 * Math.PI * r;
  return (
    <div className="cr-cadran" style={{ width: taille, height: taille }}>
      <span className="cr-halo" />
      <svg viewBox="0 0 100 100" focusable="false">
        <circle className="cr-piste" cx="50" cy="50" r={r} fill="none" strokeWidth={epaisseur} />
        <circle
          className="cr-arc"
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth={epaisseur}
          strokeDasharray={circonference}
          strokeDashoffset={circonference * (1 - fraction)}
        />
        <g className="cr-trotteuse" style={{ animationDelay: `${departTrotteuse}s` }}>
          <circle cx="50" cy={50 - r} r={epaisseur / 3.2} />
        </g>
      </svg>
      <div className="cr-centre">{children}</div>
    </div>
  );
}

/** Deux chiffres qui basculent, et leur unité en toutes lettres. */
function Bloc({ valeur, unite }) {
  const texte = String(valeur).padStart(2, '0');
  return (
    <div className="cr-bloc">
      <div className="cr-cases">
        {texte.split('').map((chiffre, i) => (
          // La clé porte le chiffre : il est remonté — et rejoue sa bascule —
          // seulement quand il change.
          <span className="cr-case" key={`${i}-${chiffre}`}>
            <span>{chiffre}</span>
          </span>
        ))}
      </div>
      <span className="cr-unite">{unite}</span>
    </div>
  );
}

/** Les sept jours qui mènent à la clôture, aujourd'hui marqué. */
function Ruban({ jours, aujourdhui, afficherIci }) {
  if (!jours.length) return null;
  return (
    <div className="cr-ruban">
      {jours.map((jour) => (
        <div
          key={`${jour.libelle}-${jour.numero}`}
          className="cr-jour"
          data-etat={jour.etat}
          data-cloture={jour.cloture ? '' : undefined}
        >
          {afficherIci && jour.etat === 'aujourdhui' && <span className="cr-ici">{aujourdhui}</span>}
          <span className="cr-jour-barre">
            <i style={{ '--r': jour.remplissage }} />
          </span>
          <span className="cr-jour-libelle">
            {jour.cloture && <Flag size={11} className="text-[color:var(--cr-plein)]" />}
            {jour.libelle}
          </span>
        </div>
      ))}
    </div>
  );
}
