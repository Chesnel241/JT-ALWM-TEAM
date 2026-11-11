import { useRef, useState } from 'react';
import { Film, Plus, Trash2, Upload } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { API_BASE, api } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { formaterDuree } from '../lib/duree.js';
import { octetsLisibles } from '../lib/envoi.js';

/**
 * Les jingles du JT : générique, virgules des reportages, des annonces, des
 * séminaires et du Mot du JT.
 *
 * LE BESOIN : ces vidéos sont montées à part, une fois, et resservent chaque
 * semaine. Déposées comme des rushes, elles disparaissaient avec leur
 * semaine. Ici elles ont leur onglet, rangées dans l'ordre du journal, et
 * restent jusqu'à ce qu'on les supprime.
 */
export const CATEGORIES_JINGLES = ['generique', 'reportages', 'annonces', 'seminaires', 'mot'];

/** Les jingles rangés par catégorie, dans l'ordre du journal. */
export function rangerJingles(jingles = []) {
  return CATEGORIES_JINGLES.map((id) => ({ id, jingles: jingles.filter((element) => element.categorie === id) }));
}

function Categorie({ id, jingles, adminPassword, onChange, onAjouterAuJT, lang }) {
  const { t } = useI18n();
  const j = t.jingles;
  const { addToast } = useToast();
  const champ = useRef(null);
  const [envoi, setEnvoi] = useState(null); // { nom, pourcent }
  const [aSupprimer, setASupprimer] = useState(null);

  const deposer = async (fichier) => {
    if (!fichier) return;
    setEnvoi({ nom: fichier.name, pourcent: 0 });
    try {
      await api.uploadJingle(fichier, id, adminPassword, (pourcent) => setEnvoi({ nom: fichier.name, pourcent }));
      addToast(j.ajoute(fichier.name), 'success', 4000);
      onChange();
    } catch (err) {
      addToast(err.message || j.echecEnvoi, 'error');
    } finally {
      setEnvoi(null);
      if (champ.current) champ.current.value = '';
    }
  };

  const supprimer = async () => {
    const cible = aSupprimer;
    setASupprimer(null);
    try {
      await api.deleteJingle(cible.id, adminPassword);
      addToast(j.supprime(cible.name), 'success', 4000);
      onChange();
    } catch (err) {
      addToast(err.message || j.echecSuppression, 'error');
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-5" aria-labelledby={`jingles-${id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`jingles-${id}`} className="text-lg font-bold text-[color:var(--ink)]">{j.categories[id].titre}</h3>
          <p className="text-sm text-[color:var(--muted)]">{j.categories[id].aide}</p>
        </div>
        <input ref={champ} type="file" accept="video/*" className="sr-only" tabIndex={-1} aria-hidden="true"
          onChange={(e) => deposer(e.target.files?.[0])} />
        <button type="button" disabled={Boolean(envoi)} onClick={() => champ.current?.click()}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl bg-[var(--action)] px-4 text-sm font-semibold text-white hover:bg-[var(--action-deep)] disabled:cursor-not-allowed disabled:opacity-50">
          <Upload size={17} aria-hidden="true" />
          {j.ajouter}
        </button>
      </div>

      {envoi && (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-3" role="status" aria-live="polite">
          <p className="mb-2 truncate text-sm font-semibold text-[color:var(--ink)]">{j.envoiEnCours(envoi.nom, Math.round(envoi.pourcent))}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
            <div className="h-full w-full origin-left rounded-full bg-[var(--action)]" style={{ transform: `scaleX(${Math.max(2, envoi.pourcent) / 100})` }} />
          </div>
        </div>
      )}

      {jingles.length === 0 && !envoi ? (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[color:var(--muted)]">{j.vide}</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {jingles.map((jingle) => (
            <li key={jingle.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--paper-2)]">
              <video src={`${API_BASE}/uploads/${encodeURIComponent(jingle.filename)}#t=0.5`} controls preload="metadata" playsInline
                className="block aspect-video w-full bg-black" />
              <div className="p-3">
                <p className="truncate text-sm font-semibold text-[color:var(--ink)]" title={jingle.name}>{jingle.name}</p>
                <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                  {[formaterDuree(jingle.durationSec), octetsLisibles(jingle.taille, lang), j.depuis(new Date(jingle.uploadedAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR'))].filter(Boolean).join(' · ')}
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => onAjouterAuJT(jingle)}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--action)] px-3 text-xs font-semibold text-white hover:bg-[var(--action-deep)]">
                    <Plus size={15} aria-hidden="true" />{j.ajouterAuJT}
                  </button>
                  <button type="button" onClick={() => setASupprimer(jingle)} aria-label={j.supprimerNom(jingle.name)} title={j.supprimer}
                    className="inline-flex min-h-[40px] w-10 items-center justify-center rounded-lg border border-[var(--border)] text-[color:var(--cta-red)] hover:bg-[var(--paper)]">
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={Boolean(aSupprimer)}
        variant="danger"
        title={j.supprimerTitre}
        message={aSupprimer ? j.supprimerTexte(aSupprimer.name) : ''}
        confirmText={j.supprimer}
        cancelText={j.annuler}
        onConfirm={supprimer}
        onCancel={() => setASupprimer(null)}
      />
    </section>
  );
}

export default function JinglesView({ jingles, adminPassword, onChange, onAjouterAuJT }) {
  const { t, lang } = useI18n();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex items-start gap-3">
        <Film className="mt-1 shrink-0 text-[color:var(--accent)]" size={24} aria-hidden="true" />
        <div>
          <h2 className="text-2xl font-bold text-[color:var(--ink)]">{t.jingles.titre}</h2>
          <p className="text-sm text-[color:var(--muted)]">{t.jingles.intro}</p>
        </div>
      </header>
      {rangerJingles(jingles).map(({ id, jingles: liste }) => (
        <Categorie key={id} id={id} jingles={liste} adminPassword={adminPassword} onChange={onChange} onAjouterAuJT={onAjouterAuJT} lang={lang} />
      ))}
    </div>
  );
}
