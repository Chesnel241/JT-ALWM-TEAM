import { Check, CheckCircle, FileVideo, FileAudio, FileImage, FileText, AlertTriangle, WifiOff, RotateCcw } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { etapesEnvoi, positionSurLiaison, estEnVol } from '../lib/envoi.js';
import { classifyFile, MEDIA_TYPES } from '../lib/mediaTypes.js';
import CountryAvatar from './CountryAvatar.jsx';

/**
 * Le voyage des fichiers, du pays du correspondant jusqu'à la rédaction.
 *
 * Une liaison relie le drapeau du pays au logo ALWM ; chaque fichier y
 * avance au pourcentage réel de son envoi, attend à l'arrivée pendant le
 * traitement, et reste au départ, en gris, quand il attend le réseau. Sous
 * la liaison, chaque fichier dit son étape : *Envoi*, *Traitement*, *Reçu*.
 *
 * C'est la réponse à « je ne sais pas si ça marche » : on voit le fichier
 * partir, on voit qu'il est arrivé.
 */
const ICONES = {
  [MEDIA_TYPES.VIDEO]: FileVideo,
  [MEDIA_TYPES.AUDIO]: FileAudio,
  [MEDIA_TYPES.IMAGE]: FileImage,
  [MEDIA_TYPES.DOCUMENT]: FileText,
};

export default function VoyageEnvoi({ pays, envois = [], onReessayer }) {
  const { t } = useI18n();
  const u = t.uploader;
  if (!envois.length) return null;
  const enVol = envois.filter(estEnVol);

  return (
    <section className="jr-voyage" aria-label={u.liaison(pays?.name || '')}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-extrabold text-[color:var(--ink)]">
          {enVol.length > 0
            ? <span className="jr-radar" aria-hidden="true" />
            : <CheckCircle size={18} className="motion-check text-[color:var(--action)]" aria-hidden="true" />}
          {enVol.length > 0 ? u.sendingNow : u.phaseDone}
        </span>
        <span className="text-xs font-semibold text-[color:var(--muted)]">{u.checklistCount(envois.length)}</span>
      </div>

      {enVol.length > 0 && (
        // La compression tourne dans le téléphone : quitter la page perdait
        // le travail sans que rien ne l'ait annoncé.
        <p className="text-xs font-medium text-[color:var(--muted)]">{u.keepOpen}</p>
      )}

      <div aria-hidden="true">
        <div className="jr-liaison">
          <span className="jr-liaison-noeud">
            <CountryAvatar country={pays} ring className="w-12 h-12" />
          </span>
          <span className="jr-liaison-piste" data-actif={enVol.length > 0 ? '' : undefined}>
            {envois.slice(-4).map((envoi) => {
              const Icone = ICONES[classifyFile(envoi)] || FileText;
              return (
                <span
                  key={envoi.id}
                  className="jr-paquet-rail"
                  data-etat={etapesEnvoi(envoi)[0].etat}
                  style={{ '--p': positionSurLiaison(envoi) }}
                >
                  <span className="jr-paquet"><Icone size={16} /></span>
                </span>
              );
            })}
          </span>
          <span className="jr-liaison-noeud jr-liaison-alwm">
            <img src="/logo-lwm.png" alt="" className="w-9 h-9 object-contain" />
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-3 text-[11px] font-bold text-[color:var(--muted)]">
          <span className="truncate">{pays?.name}</span>
          <span className="truncate text-right">{u.redaction}</span>
        </div>
      </div>

      <ul className="space-y-2.5">
        {envois.map((envoi) => (
          <LigneEnvoi key={envoi.id} envoi={envoi} u={u} onReessayer={onReessayer} />
        ))}
      </ul>
    </section>
  );
}

function LigneEnvoi({ envoi, u, onReessayer }) {
  const etapes = etapesEnvoi(envoi);
  const [envoiEtape, traitement] = etapes;

  let etat = u.phaseDone;
  if (envoiEtape.etat === 'actif') etat = `${Math.round(Number(envoi.progress) || 0)}%`;
  else if (envoiEtape.etat === 'attente') etat = u.offlineBadge;
  else if (envoiEtape.etat === 'erreur') etat = envoi.error || u.errorPrefix;
  else if (traitement.etat === 'actif') etat = envoi.isVideo ? u.phaseCompressing : u.phaseProcessing;

  const ton = envoiEtape.etat === 'erreur'
    ? 'text-[color:var(--cta-orange-deep)]'
    : envoiEtape.etat === 'attente'
      ? 'text-[color:var(--muted)]'
      : etapes[2].etat === 'fait'
        ? 'text-[color:var(--action-deep)]'
        : 'text-[color:var(--accent-deep)]';

  return (
    <li className="rounded-2xl bg-[var(--paper)] border border-[var(--border)] p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-bold text-[color:var(--ink)]">{envoi.name}</span>
        <span className={`shrink-0 text-xs font-extrabold ${ton}`}>{etat}</span>
      </div>

      <ol className="jr-etapes-envoi">
        {etapes.map((etape, i) => (
          <li key={etape.cle} className="contents">
            {i > 0 && <span className="jr-pas-trait" data-fait={etapes[i - 1].etat === 'fait' ? '' : undefined} aria-hidden="true" />}
            <span className="jr-pas" data-etat={etape.etat}>
              <span className="jr-pas-point" aria-hidden="true">
                {etape.etat === 'fait' && <Check size={13} strokeWidth={3.2} />}
                {etape.etat === 'erreur' && <AlertTriangle size={12} strokeWidth={2.8} />}
                {etape.etat === 'attente' && <WifiOff size={12} strokeWidth={2.6} />}
              </span>
              {u.etapes[etape.cle]}
            </span>
          </li>
        ))}
      </ol>

      {envoiEtape.etat === 'erreur' && onReessayer && (
        // Le fichier est encore en mémoire : un geste suffit, sans repasser
        // par le sélecteur. Orange : c'est une reprise, pas un nouvel envoi.
        <button
          type="button"
          onClick={() => onReessayer(envoi.id)}
          className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-xl bg-[var(--cta-orange)] text-white font-extrabold text-sm active:scale-[0.98] motion-tap"
        >
          <RotateCcw size={16} />
          {u.retryCta}
        </button>
      )}
    </li>
  );
}
