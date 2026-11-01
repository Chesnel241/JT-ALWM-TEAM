import {
  ChevronRight, RefreshCw, AlertCircle, Check, Download, Hourglass, FileUp, Mic, Film,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { etapesParcours } from '../lib/parcours.js';
import { useLivraisons } from '../hooks/useLivraisons.js';

/**
 * Où en est ce pays cette semaine : vos fichiers, votre voix off, le JT.
 *
 * Il vivait sur l'accueil, qui devinait le pays du correspondant d'après le
 * dernier pays ouvert sur l'appareil. L'accueil ne devine plus rien : le
 * suivi est maintenant en tête de l'espace du pays, où le pays est connu par
 * l'adresse (`/journalistes/cm`), sans rien mémoriser.
 */
const ICONES_ETAPES = { reportage: FileUp, voixOff: Mic, jt: Film };

export default function ParcoursPays({
  fichiers = [],
  chargement = false,
  weekId,
  onVoirFichiers,
  onOpenVoixOff,
  onOpenDelivery,
  compact = false,
}) {
  const { t } = useI18n();
  const r = t.reporter;
  const p = r.parcours;
  const livraisons = useLivraisons(weekId);
  const parcours = etapesParcours({ fichiers, livraisons });
  const refuses = fichiers.filter((f) => f && f.status === 'rejected');
  const valides = fichiers.filter((f) => f && f.status === 'approved');

  const ouvrir = { reportage: onVoirFichiers, voixOff: onOpenVoixOff, jt: onOpenDelivery };
  const titres = { reportage: p.reportage, voixOff: p.voixOff, jt: p.jt };

  const legende = (etape) => {
    if (etape.cle === 'reportage') {
      if (chargement) return r.statusLoading;
      if (etape.etat === 'aCorriger') return r.statusRejected(etape.nombre);
      if (etape.etat === 'fait') {
        return valides.length > 0
          ? `${r.statusSent(etape.nombre)} · ${r.statusApproved(valides.length)}`
          : r.statusSent(etape.nombre);
      }
      return p.aFaire;
    }
    if (etape.cle === 'voixOff') return etape.etat === 'fait' ? p.voixEnvoyee(etape.nombre) : p.facultatif;
    return etape.etat === 'pret' ? p.pret : p.enAttente;
  };

  const icone = (etape) => {
    if (chargement && etape.cle === 'reportage') return RefreshCw;
    if (etape.etat === 'fait') return Check;
    if (etape.etat === 'aCorriger') return AlertCircle;
    if (etape.etat === 'enAttente') return Hourglass;
    if (etape.etat === 'pret') return Download;
    return ICONES_ETAPES[etape.cle];
  };

  return (
    // Compact sur téléphone : trois points et leur légende, sans titre, pour
    // ne pas repousser les boutons d'envoi sous le pouce.
    <section className="jr-parcours-carte" data-compact={compact ? '' : undefined} aria-label={p.titre}>
      {!compact && <h3 className="text-base sm:text-lg font-extrabold text-[color:var(--ink)]">{p.titre}</h3>}

      <div className={`jr-parcours ${compact ? '' : 'mt-8'}`}>
        <span className="jr-trait" aria-hidden="true">
          <i style={{ '--r': parcours.remplissage }} />
        </span>
        {parcours.etapes.map((etape) => {
          const Icone = icone(etape);
          const aVous = parcours.aVous === etape.cle;
          return (
            <button
              key={etape.cle}
              type="button"
              onClick={ouvrir[etape.cle]}
              className="jr-etape focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--accent)]/40"
              data-etat={etape.etat}
              data-avous={aVous ? '' : undefined}
            >
              <span className="jr-noeud" aria-hidden="true">
                {aVous && !compact && <span className="jr-avous">{p.aVous}</span>}
                <Icone size={compact ? 18 : 24} strokeWidth={2.4} className={chargement && etape.cle === 'reportage' ? 'animate-spin' : ''} />
              </span>
              <span className="text-sm font-extrabold text-[color:var(--ink)] leading-tight">{titres[etape.cle]}</span>
              <span className={`text-xs font-semibold leading-snug ${etape.etat === 'aCorriger' ? 'text-[color:var(--cta-orange-deep)]' : 'text-[color:var(--muted)]'}`}>
                {legende(etape)}
              </span>
            </button>
          );
        })}
      </div>

      {refuses.length > 0 && (
        <button
          type="button"
          onClick={onVoirFichiers}
          className="mt-5 w-full flex items-center justify-between gap-3 rounded-2xl bg-[var(--cta-orange)] text-white px-4 py-3.5 font-bold active:scale-[0.99] motion-tap"
        >
          <span className="flex items-center gap-2 text-left">
            <AlertCircle size={20} className="shrink-0" />
            {r.statusRejected(refuses.length)}
          </span>
          <span className="flex items-center gap-1 text-sm underline underline-offset-2 shrink-0">
            {r.statusRejectedCta}
            <ChevronRight size={16} />
          </span>
        </button>
      )}
    </section>
  );
}
