import { useId, useState } from 'react';
import { Download, Play, Sparkles, CheckCircle, FileVideo, FileAudio, FileText, Smartphone, Tv } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { tailleLisible } from '../lib/taille.js';
import { API_BASE } from '../api/index.js';
import { formatRelative, formatAbsolute, formatWeekFull } from '../lib/dates.js';
import SkeletonCard from './SkeletonCard.jsx';
import WaitingBroadcast from './illustrations/WaitingBroadcast.jsx';
import { lireVus, ecrireVus } from '../lib/jtVus.js';
import { minutage } from '../lib/sommaire.js';
import { legerPret } from './LecteurJT.jsx';

/** Au-delà, le sommaire se replie : la carte reste lisible d'un coup d'œil. */
const PARTIES_VISIBLES = 5;

/**
 * Le JT de la semaine, côté journalistes.
 *
 * L'écran était celui du montage, sans son outil de publication : une
 * liste de noms de fichiers, et un petit lien « Télécharger ». Ici, chaque
 * JT est une grande carte avec un écran de télévision qu'on touche pour le
 * regarder, un bouton vert pour le télécharger et un bleu pour le regarder,
 * et une pastille « Nouveau » tant que cet appareil ne l'a ni vu ni
 * téléchargé.
 *
 * La progression du téléchargement reste celle du navigateur : la suivre
 * ici obligerait à charger tout le JT (plusieurs centaines de Mo) dans la
 * mémoire du téléphone avant de l'enregistrer. L'écran dit donc que le
 * téléchargement a commencé, et où le fichier arrive.
 */

export function estVideo(fichier) {
  return fichier?.type === 'video' || /\.(mp4|mov|m4v|webm)$/i.test(fichier?.name || '');
}

function Icone({ fichier, size }) {
  if (estVideo(fichier)) return <FileVideo size={size} />;
  if (fichier?.type === 'audio') return <FileAudio size={size} />;
  return <FileText size={size} />;
}

export default function JTPretJournaliste({ weeks, selectedWeek, setSelectedWeek, livraisons, chargement, onRegarder }) {
  const { t, lang } = useI18n();
  const j = t.jtPret;
  const idSemaine = useId();
  const [vus, setVus] = useState(lireVus);
  const [lances, setLances] = useState(() => new Set());
  const [deplies, setDeplies] = useState(() => new Set());
  const pret = livraisons.length > 0;

  const marquerVu = (id) => {
    setVus((avant) => {
      if (avant.has(id)) return avant;
      const apres = new Set(avant).add(id);
      ecrireVus(apres);
      return apres;
    });
  };

  const regarder = (fichier, debut = 0) => {
    marquerVu(fichier.id);
    onRegarder?.(fichier, debut);
  };

  const telecharger = (fichier) => {
    marquerVu(fichier.id);
    setLances((avant) => new Set(avant).add(fichier.id));
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="jr-ciel px-4 py-6 sm:py-9 text-center">
        <span className="badge bg-[var(--paper)] text-[color:var(--accent-deep)] shadow-sm inline-flex items-center gap-1.5">
          <Sparkles size={14} /> {t.nav.delivery}
        </span>
        <h2 className="mt-3 text-2xl sm:text-4xl font-extrabold text-[color:var(--ink)] leading-tight">
          {pret ? j.titrePret : j.titreAttente}
        </h2>
        <p className="mt-2 text-sm sm:text-lg text-[color:var(--muted)] max-w-xl mx-auto">
          {pret ? j.introPret : j.introAttente}
        </p>
        <div className="mt-5 max-w-sm mx-auto text-left">
          <label htmlFor={idSemaine} className="block text-sm font-bold text-[color:var(--ink)] mb-1.5">
            {t.delivery.weekLabel}
          </label>
          <select
            id={idSemaine}
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="w-full min-h-[52px] rounded-2xl border-2 border-[var(--border)] bg-[var(--paper)] px-3 sm:px-4 text-base font-bold text-[color:var(--ink)] shadow-sm focus:outline-none focus:border-[color:var(--accent)] cursor-pointer"
          >
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {formatWeekFull(w, lang)}{w.status === 'active' ? t.uploader.weekActiveTag : ''}
              </option>
            ))}
          </select>
        </div>
      </header>

      {chargement ? (
        <SkeletonCard count={1} />
      ) : !pret ? (
        <div className="jr-jt-attente rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--paper)] px-5 py-8 text-center">
          <div className="mx-auto w-fit">
            <WaitingBroadcast size={150} />
          </div>
          <p className="mt-3 text-lg font-extrabold text-[color:var(--ink)]">{t.delivery.empty}</p>
          <p className="mt-1.5 text-sm sm:text-base text-[color:var(--muted)] max-w-md mx-auto">
            {t.delivery.emptyHintReporter}
          </p>
        </div>
      ) : (
        <ul className="grid gap-5 lg:grid-cols-2">
          {livraisons.map((fichier, i) => {
            const video = estVideo(fichier);
            const nouveau = !vus.has(fichier.id);
            const lien = `${API_BASE}/uploads/${encodeURIComponent(fichier.filename)}?dl=1`;
            return (
              <li key={fichier.id} className="jr-jt motion-rise" style={{ '--i': i }}>
                <button
                  type="button"
                  className="jr-jt-ecran"
                  onClick={() => (video ? regarder(fichier) : undefined)}
                  disabled={!video}
                  aria-label={video ? j.regarderNom(fichier.name) : fichier.name}
                >
                  <img src="/logo-lwm.png" alt="" className="jr-jt-logo" />
                  <span className="jr-jt-lecture" aria-hidden="true">
                    {video ? <Play size={34} className="fill-current translate-x-0.5" /> : <Icone fichier={fichier} size={34} />}
                  </span>
                  {nouveau && <span className="jr-nouveau">{j.nouveau}</span>}
                </button>

                <div className="p-4 sm:p-5 space-y-4">
                  <div>
                    <p className="text-lg font-extrabold text-[color:var(--ink)] break-words leading-snug">{fichier.name}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted)] flex flex-wrap items-center gap-x-2">
                      {fichier.size && <span>{fichier.size}</span>}
                      {fichier.size && fichier.uploadedAt && <span aria-hidden="true">·</span>}
                      {fichier.uploadedAt && (
                        <span title={formatAbsolute(fichier.uploadedAt, lang)}>
                          {j.publie(formatRelative(fichier.uploadedAt, lang))}
                        </span>
                      )}
                    </p>
                  </div>

                  {(() => {
                    const leger = legerPret(fichier);
                    const tailleTV = tailleLisible(fichier.size);
                    const lienLeger = leger ? `${API_BASE}/uploads/${encodeURIComponent(leger.filename)}?dl=1` : null;
                    return (
                      <div className="space-y-3">
                        <div className={`grid gap-3 ${video ? 'sm:grid-cols-2' : ''}`}>
                          {leger ? (
                            <a
                              href={lienLeger}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => telecharger(fichier)}
                              aria-label={j.telechargerLegerNom(fichier.name, tailleLisible(leger.size))}
                              className="jr-bouton jr-bouton-vert w-full min-h-[56px] text-base"
                            >
                              <Smartphone size={20} className="jr-jt-fleche" aria-hidden="true" />
                              <span className="flex flex-col items-start leading-tight text-left">
                                <span>{j.telechargerLeger(tailleLisible(leger.size))}</span>
                                <span className="text-xs font-semibold opacity-90">{j.legerConseil}</span>
                              </span>
                            </a>
                          ) : (
                            <a
                              href={lien}
                              download={fichier.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => telecharger(fichier)}
                              aria-label={j.telechargerNom(fichier.name)}
                              className="jr-bouton jr-bouton-vert w-full min-h-[56px] text-base"
                            >
                              <Download size={20} className="jr-jt-fleche" aria-hidden="true" />
                              {/* La taille sur le bouton : 450 Mo sur une 4G payée au
                                  mégaoctet, c'est une décision qu'on prend avant de
                                  toucher, pas après. */}
                              <span className="flex flex-col items-start leading-tight text-left">
                                <span>{tailleTV ? j.telechargerTaille(tailleTV) : j.telecharger}</span>
                                {tailleTV && <span className="text-xs font-semibold opacity-90">{j.wifiConseil}</span>}
                              </span>
                            </a>
                          )}
                          {video && (
                            <button
                              type="button"
                              onClick={() => regarder(fichier)}
                              aria-label={j.regarderNom(fichier.name)}
                              className="jr-bouton jr-bouton-bleu w-full min-h-[56px] text-base"
                            >
                              <Play size={18} className="fill-current" aria-hidden="true" />
                              <span>{j.regarder}</span>
                            </button>
                          )}
                        </div>

                        {/* Le master en qualité TV reste là, en second : pour qui
                            diffuse le JT, ou télécharge en Wi-Fi. */}
                        {leger && (
                          <a
                            href={lien}
                            download={fichier.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => telecharger(fichier)}
                            aria-label={j.telechargerTVNom(fichier.name, tailleTV)}
                            className="jr-bouton jr-bouton-contour w-full min-h-[48px] text-sm"
                          >
                            <Tv size={18} aria-hidden="true" />
                            <span className="flex flex-col items-start leading-tight text-left">
                              <span>{j.telechargerTV(tailleTV)}</span>
                              <span className="text-xs font-semibold opacity-80">{j.tvConseil}</span>
                            </span>
                          </a>
                        )}

                        {fichier.leger?.statut === 'en_cours' && (
                          <p className="jr-jt-prepare flex items-start gap-2.5 rounded-2xl bg-[var(--paper-2)] px-3 py-2.5 text-sm text-[color:var(--ink)]">
                            <span className="motion-attente mt-1.5 shrink-0" aria-hidden="true" />
                            <span>{j.legerEnPreparation}</span>
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {video && Array.isArray(fichier.sommaire) && fichier.sommaire.length > 0 && (() => {
                    const tout = deplies.has(fichier.id) || fichier.sommaire.length <= PARTIES_VISIBLES + 1;
                    const parties = tout ? fichier.sommaire : fichier.sommaire.slice(0, PARTIES_VISIBLES);
                    return (
                      <div className="jr-jt-sommaire border-t border-[var(--border)] pt-3">
                        <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">{j.auSommaire}</h3>
                        <ol className="-mx-2">
                          {parties.map((c, k) => (
                            <li key={`${c.t}-${k}`}>
                              <button
                                type="button"
                                onClick={() => regarder(fichier, c.t)}
                                aria-label={j.regarderA(minutage(c.t), c.titre)}
                                className="jr-jt-partie flex min-h-[44px] w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left"
                              >
                                <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-[color:var(--muted)]">{minutage(c.t)}</span>
                                <span className="min-w-0 flex-1 text-sm leading-snug text-[color:var(--ink)]">{c.titre}</span>
                                <Play size={14} className="jr-jt-partie-play shrink-0 text-[color:var(--accent-deep)]" aria-hidden="true" />
                              </button>
                            </li>
                          ))}
                        </ol>
                        {!tout && (
                          <button
                            type="button"
                            onClick={() => setDeplies((avant) => new Set(avant).add(fichier.id))}
                            className="mt-1 min-h-[44px] text-sm font-bold text-[color:var(--accent-deep)] underline-offset-2 hover:underline"
                          >
                            {j.voirTout(fichier.sommaire.length)}
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {lances.has(fichier.id) && (
                    <div role="status" className="jr-jt-lance flex items-start gap-3 rounded-2xl bg-v-action/10 border border-v-action/30 p-3">
                      <span className="jr-jt-plateau" aria-hidden="true">
                        <Download size={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-extrabold text-[color:var(--action-deep)]">
                          <CheckCircle size={16} className="motion-check" aria-hidden="true" /> {j.lance}
                        </span>
                        <span className="block mt-0.5 text-sm text-[color:var(--ink)]">{j.lanceAide}</span>
                      </span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
