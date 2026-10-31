import { useId } from 'react';
import {
  Mic, Square, Pause, Play, Send, RotateCcw, FileAudio, CheckCircle, AlertTriangle, ZoomIn, ZoomOut, UploadCloud,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { formatWeekLabel, formatWeekDates } from '../lib/dates.js';
import CountryAvatar from './CountryAvatar.jsx';

/**
 * Le studio de voix off, côté journalistes.
 *
 * Le studio commun était pensé pour la rédaction : un panneau noir façon
 * console, des libellés techniques (« ENREGISTREUR TV », « Direct Micro »,
 * « Auto-scroll »), tous écrits en français en dur. Ici, sur fond clair :
 * trois étapes numérotées, un gros bouton rouge rond qui pulse pendant la
 * prise, une onde qui suit la voix, le chronomètre en grand, puis un
 * bouton vert pour envoyer. La logique d'enregistrement reste celle de
 * VoixOffView, qui fournit l'état et les gestes.
 */

const BARRES = 24;
// Le profil de l'onde : plus haute au centre, comme une voix.
const PROFIL = Array.from({ length: BARRES }, (_, i) => 0.35 + 0.65 * Math.sin(((i + 0.5) / BARRES) * Math.PI));

export function chrono(secondes) {
  const s = Math.max(0, Math.floor(Number(secondes) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function Onde({ niveau, actif }) {
  // Le niveau mesuré reste bas pour une voix parlée (souvent sous 20 sur
  // 100) : la racine carrée l'amplifie là où il est faible, pour que l'onde
  // réagisse même à une voix douce, sans dépasser la boîte.
  const force = actif ? Math.min(1, Math.sqrt(Math.max(0, Number(niveau) || 0) / 30)) : 0;
  return (
    <div className="jr-onde" data-actif={actif ? '' : undefined} aria-hidden="true">
      {PROFIL.map((p, i) => (
        <span
          key={i}
          className="jr-onde-barre"
          style={{ '--h': actif ? 0.22 + 0.78 * force * p : 0.12, '--i': i }}
        />
      ))}
    </div>
  );
}

function Etape({ numero, titre, children }) {
  return (
    <section className="rounded-3xl border-2 border-[var(--border)] bg-[var(--paper)] p-4 sm:p-6 space-y-4 shadow-sm">
      <h3 className="flex items-center gap-3 text-lg sm:text-xl font-extrabold text-[color:var(--ink)]">
        <span className="h-9 w-9 shrink-0 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-base">
          {numero}
        </span>
        {titre}
      </h3>
      {children}
    </section>
  );
}

export default function StudioVoixJournaliste({
  pays,
  paysDisponibles = [],
  choisirPays,
  semaines = [],
  semaine,
  setSemaine,
  mode,
  setMode,
  reportageNum,
  choisirReportage,
  titre,
  setTitre,
  script,
  setScript,
  tailleTexte,
  setTailleTexte,
  enregistre,
  enPause,
  demarrage,
  secondes,
  niveau,
  sature,
  audioUrl,
  envoiEnCours,
  etapeEnvoi,
  voixEnvoyee,
  microRefuse = false,
  defilement,
  setDefilement,
  prompteurRef,
  fichierRef,
  onDemarrer,
  onPause,
  onReprendre,
  onTerminer,
  onRecommencer,
  onEnvoyer,
  onFichier,
}) {
  const { t, lang } = useI18n();
  const v = t.voix;
  const idSemaine = useId();
  const idTitre = useId();
  const idTexte = useId();
  const aDuTexte = Boolean(script?.trim());
  const etatMicro = enregistre ? (enPause ? 'pause' : 'rec') : 'pret';

  return (
    <div className="space-y-5 pb-10">
      <header className="jr-ciel px-4 py-6 sm:py-9 text-center">
        {/* Une pastille teintée, pas un rond rouge plein : celui-là est le
            bouton d'enregistrement, plus bas, et ne doit pas avoir de sosie. */}
        <span className="mx-auto h-14 w-14 rounded-2xl bg-[var(--cta-red)]/10 text-[color:var(--cta-red-deep)] flex items-center justify-center" aria-hidden="true">
          <Mic size={28} />
        </span>
        <h2 className="mt-3 text-2xl sm:text-4xl font-extrabold text-[color:var(--ink)] leading-tight">{v.titre}</h2>
        <p className="mt-2 text-sm sm:text-lg text-[color:var(--muted)] max-w-xl mx-auto">{v.intro}</p>

        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-end justify-center gap-3 max-w-2xl mx-auto text-left">
          {pays ? (
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--paper)] border-2 border-[var(--border)] px-3 py-2 min-h-[52px] shadow-sm">
              <CountryAvatar country={pays} ring className="h-10 w-10" />
              <span className="font-extrabold text-[color:var(--ink)]">{pays.name}</span>
              {paysDisponibles.length > 1 && (
                <button
                  type="button"
                  onClick={() => choisirPays(null)}
                  className="ml-auto min-h-[44px] px-3 rounded-xl text-sm font-bold text-[color:var(--accent-deep)] hover:bg-[var(--paper-2)]"
                >
                  {v.changerPays}
                </button>
              )}
            </div>
          ) : null}
          <div className="sm:min-w-[16rem]">
            <label htmlFor={idSemaine} className="block text-sm font-bold text-[color:var(--ink)] mb-1.5">{v.semaine}</label>
            <select
              id={idSemaine}
              value={semaine}
              onChange={(e) => setSemaine?.(e.target.value)}
              className="w-full min-h-[52px] rounded-2xl border-2 border-[var(--border)] bg-[var(--paper)] px-3 sm:px-4 text-sm sm:text-base font-bold text-[color:var(--ink)] shadow-sm focus:outline-none focus:border-[color:var(--accent)] cursor-pointer"
            >
              {semaines.map((w) => (
                <option key={w.id} value={w.id}>
                  {formatWeekLabel(w, lang)} ({formatWeekDates(w, lang)})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {!pays && (
        <section className="rounded-3xl border-2 border-[var(--border)] bg-[var(--paper)] p-4 sm:p-6 space-y-3">
          <h3 className="text-lg font-extrabold text-[color:var(--ink)]">{v.choisirPays}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {paysDisponibles.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => choisirPays(c)}
                className="jr-tuile !min-h-0 !py-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--accent)]/40"
              >
                <CountryAvatar country={c} ring className="h-12 w-12" />
                <span className="font-extrabold text-[color:var(--ink)] break-words">{c.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="space-y-5">
          <Etape numero={1} titre={v.etapeReportage}>
            <div className="grid grid-cols-3 gap-2.5" role="group" aria-label={v.etapeReportage}>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={reportageNum === n}
                  onClick={() => choisirReportage(n)}
                  className={`min-h-[56px] rounded-2xl border-2 px-2 text-sm sm:text-base font-extrabold motion-tap active:scale-95 ${
                    reportageNum === n
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-md'
                      : 'bg-[var(--paper)] border-[var(--border)] text-[color:var(--ink)] hover:border-[color:var(--accent)]'
                  }`}
                >
                  {v.reportage(n)}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor={idTitre} className="block text-sm font-bold text-[color:var(--ink)] mb-1.5">{v.titreLabel}</label>
              <input
                id={idTitre}
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder={v.titrePh}
                maxLength={120}
                className="w-full min-h-[56px] rounded-2xl border-2 border-[var(--border)] bg-[var(--paper)] px-4 text-base font-semibold text-[color:var(--ink)] outline-none focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[color:var(--accent)]/15"
              />
            </div>
          </Etape>

          <Etape numero={2} titre={v.etapeTexte}>
            <div className="flex items-center justify-between gap-3">
              <p id={`${idTexte}-aide`} className="text-sm text-[color:var(--muted)]">{v.texteAide}</p>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setTailleTexte((s) => Math.max(16, s - 2))}
                  aria-label={v.plusPetit}
                  title={v.plusPetit}
                  className="h-11 w-11 rounded-xl border-2 border-[var(--border)] flex items-center justify-center text-[color:var(--ink)] hover:bg-[var(--paper-2)] active:scale-95"
                >
                  <ZoomOut size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setTailleTexte((s) => Math.min(36, s + 2))}
                  aria-label={v.plusGrand}
                  title={v.plusGrand}
                  className="h-11 w-11 rounded-xl border-2 border-[var(--border)] flex items-center justify-center text-[color:var(--ink)] hover:bg-[var(--paper-2)] active:scale-95"
                >
                  <ZoomIn size={18} />
                </button>
              </div>
            </div>
            <textarea
              id={idTexte}
              aria-label={v.etapeTexte}
              aria-describedby={`${idTexte}-aide`}
              rows={6}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={v.textePh}
              style={{ fontSize: `${tailleTexte}px` }}
              className="w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--paper)] p-4 leading-relaxed text-[color:var(--ink)] outline-none resize-y focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[color:var(--accent)]/15"
            />
          </Etape>
        </div>

        <div id="tour-voixoff-studio">
          <Etape numero={3} titre={v.etapeVoix}>
            <div className="grid grid-cols-2 gap-2.5" role="group" aria-label={v.etapeVoix}>
              {[
                { cle: 'record', Icon: Mic, libelle: v.modeMicro },
                { cle: 'upload', Icon: FileAudio, libelle: v.modeFichier },
              ].map(({ cle, Icon, libelle }) => (
                <button
                  key={cle}
                  type="button"
                  aria-pressed={mode === cle}
                  disabled={enregistre || envoiEnCours}
                  onClick={() => setMode(cle)}
                  className={`min-h-[56px] rounded-2xl border-2 px-3 flex items-center justify-center gap-2 text-sm sm:text-base font-extrabold motion-tap active:scale-95 disabled:opacity-50 ${
                    mode === cle
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-md'
                      : 'bg-[var(--paper)] border-[var(--border)] text-[color:var(--ink)] hover:border-[color:var(--accent)]'
                  }`}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{libelle}</span>
                </button>
              ))}
            </div>

            {voixEnvoyee && !audioUrl && !enregistre && (
              <div role="status" className="rounded-2xl bg-[var(--action)]/10 border-2 border-[var(--action)]/30 p-4 flex items-start gap-3">
                <CheckCircle size={24} className="motion-check shrink-0 text-[color:var(--action)]" aria-hidden="true" />
                <div>
                  <p className="font-extrabold text-[color:var(--action-deep)]">{v.envoyee}</p>
                  <p className="text-sm text-[color:var(--muted)] mt-0.5">{v.encore}</p>
                </div>
              </div>
            )}

            {aDuTexte && (mode === 'record' || enregistre) && !audioUrl && (
              <div className="space-y-2">
                <div
                  ref={prompteurRef}
                  className="jr-prompteur"
                  data-actif={enregistre && !enPause ? '' : undefined}
                  style={{ fontSize: `${Math.max(18, tailleTexte)}px` }}
                >
                  <p className="whitespace-pre-wrap">{script}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDefilement(!defilement)}
                  aria-pressed={defilement}
                  className="min-h-[44px] px-4 rounded-xl border-2 border-[var(--border)] bg-[var(--paper)] text-sm font-bold text-[color:var(--accent-deep)] inline-flex items-center gap-2 active:scale-95"
                >
                  {defilement ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                  {defilement ? v.arreterDefiler : v.defiler}
                </button>
              </div>
            )}

            {audioUrl ? (
              <div className="space-y-4">
                <p className="flex items-center gap-2 font-bold text-[color:var(--action-deep)]">
                  <CheckCircle size={20} className="motion-check" aria-hidden="true" /> {v.pret}
                </p>
                <audio src={audioUrl} controls className="w-full" />
                {envoiEnCours && (
                  <p role="status" className="flex items-center gap-3 rounded-2xl bg-[var(--accent)]/10 px-4 py-3 font-bold text-[color:var(--accent-deep)]">
                    <span className="jr-radar" aria-hidden="true" />
                    {etapeEnvoi}
                  </p>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={envoiEnCours}
                    onClick={onRecommencer}
                    className="jr-bouton jr-bouton-orange w-full disabled:opacity-50"
                  >
                    <RotateCcw size={18} aria-hidden="true" /> {v.recommencer}
                  </button>
                  <button
                    type="button"
                    disabled={envoiEnCours || !pays}
                    onClick={onEnvoyer}
                    className="jr-bouton jr-bouton-vert w-full min-h-[60px] text-lg disabled:opacity-50"
                  >
                    {envoiEnCours
                      ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                      : <Send size={20} aria-hidden="true" />}
                    {v.envoyer}
                  </button>
                </div>
              </div>
            ) : mode === 'upload' ? (
              <div>
                <input
                  ref={fichierRef}
                  type="file"
                  accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
                  onChange={onFichier}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fichierRef.current?.click()}
                  disabled={!pays}
                  className="jr-depot w-full flex flex-col items-center gap-2 px-4 py-8 disabled:opacity-50"
                >
                  <span className="jr-depot-nuage h-16 w-16 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center shadow-md">
                    <UploadCloud size={30} aria-hidden="true" />
                  </span>
                  <span className="text-base font-extrabold text-[color:var(--ink)]">{v.fichierChoisir}</span>
                  <span className="text-sm text-[color:var(--muted)]">{v.fichierFormats}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-2">
                <div className="jr-micro" data-etat={etatMicro}>
                  <span className="jr-micro-halo" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={enregistre ? onTerminer : onDemarrer}
                    disabled={demarrage || !pays}
                    aria-label={enregistre ? v.terminer : v.demarrer}
                    className="jr-micro-bouton"
                  >
                    {enregistre ? <Square size={34} className="fill-current" /> : <Mic size={42} />}
                  </button>
                </div>

                <p className="text-center" aria-live="polite">
                  <span className="block font-mono tabular-nums text-4xl sm:text-5xl font-black text-[color:var(--ink)]">
                    {chrono(secondes)}
                  </span>
                  <span className={`mt-1 inline-flex items-center gap-2 text-base font-extrabold ${
                    etatMicro === 'rec' ? 'text-[color:var(--cta-red-deep)]' : etatMicro === 'pause' ? 'text-[color:var(--cta-orange-deep)]' : 'text-[color:var(--muted)]'
                  }`}>
                    {etatMicro === 'rec' && <span className="jr-micro-point" aria-hidden="true" />}
                    {demarrage ? v.demarrage : etatMicro === 'rec' ? v.enCours : etatMicro === 'pause' ? v.enPause : v.appuyer}
                  </span>
                </p>

                <Onde niveau={niveau} actif={etatMicro === 'rec'} />

                {microRefuse && !enregistre && (
                  <div role="alert" className="w-full rounded-2xl bg-[var(--cta-orange)]/10 border-2 border-[var(--cta-orange)]/40 p-4 space-y-3">
                    <p className="flex items-start gap-2 text-sm font-bold text-[color:var(--ink)]">
                      <AlertTriangle size={18} className="shrink-0 mt-0.5 text-[color:var(--cta-orange)]" aria-hidden="true" />
                      {v.erreurMicro}
                    </p>
                    <button type="button" onClick={() => setMode('upload')} className="jr-bouton jr-bouton-bleu w-full">
                      <FileAudio size={18} aria-hidden="true" /> {v.modeFichier}
                    </button>
                  </div>
                )}

                {sature && etatMicro === 'rec' && (
                  <p role="alert" className="flex items-center gap-2 rounded-2xl bg-[var(--cta-orange)]/10 border-2 border-[var(--cta-orange)]/40 px-4 py-2.5 text-sm font-bold text-[color:var(--ink)]">
                    <AlertTriangle size={18} className="shrink-0 text-[color:var(--cta-orange)]" aria-hidden="true" />
                    {v.sature}
                  </p>
                )}

                {enregistre && (
                  <div className="grid grid-cols-2 gap-3 w-full">
                    {enPause ? (
                      <button type="button" onClick={onReprendre} className="jr-bouton jr-bouton-vert w-full">
                        <Play size={18} className="fill-current" aria-hidden="true" /> {v.reprendre}
                      </button>
                    ) : (
                      <button type="button" onClick={onPause} className="jr-bouton jr-bouton-orange w-full">
                        <Pause size={18} aria-hidden="true" /> {v.pause}
                      </button>
                    )}
                    <button type="button" onClick={onTerminer} className="jr-bouton jr-bouton-bleu w-full">
                      <Square size={16} className="fill-current" aria-hidden="true" /> {v.terminer}
                    </button>
                  </div>
                )}
              </div>
            )}
          </Etape>
        </div>
      </div>
    </div>
  );
}
