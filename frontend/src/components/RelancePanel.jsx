import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, AlertCircle, Clock, ChevronDown, Check } from 'lucide-react';
import { api } from '../api/index.js';
import { useI18n } from '../i18n/I18nContext.jsx';

/**
 * La relance du samedi, et les demandes de délai en attente.
 *
 * Deux corvées qui se faisaient hors de l'application : parcourir le tableau
 * de bord pays par pays pour voir qui n'avait rien envoyé, puis chercher son
 * numéro dans les contacts du téléphone. La plateforme savait déjà les deux —
 * il ne manquait que de les mettre côte à côte.
 *
 * Les demandes de délai, elles, n'allaient nulle part : enregistrées, puis
 * visibles seulement dans l'onglet Statistiques, que personne n'ouvre le
 * dimanche matin. Le correspondant croyait avoir engagé quelque chose.
 *
 * Le panneau se referme de lui-même quand il n'y a rien à faire : un bandeau
 * permanent qui dit « rien à signaler » finit par ne plus être lu.
 */
export default function RelancePanel({ selectedWeek, adminPassword, week }) {
  const { t } = useI18n();
  const r = t.relance;

  const [aRelancer, setARelancer] = useState([]);
  const [demandes, setDemandes] = useState([]);
  const [deplie, setDeplie] = useState(false);
  const [charge, setCharge] = useState(false);

  const recharger = useCallback(() => {
    if (!selectedWeek || !adminPassword) {
      setARelancer([]);
      setDemandes([]);
      setCharge(false);
      return;
    }
    Promise.all([
      api.getRelances(selectedWeek, adminPassword).catch(() => []),
      api.getDemandesDelai(selectedWeek, adminPassword).catch(() => []),
    ]).then(([relances, delais]) => {
      setARelancer(Array.isArray(relances) ? relances : []);
      setDemandes(Array.isArray(delais) ? delais : []);
      setCharge(true);
    });
  }, [selectedWeek, adminPassword]);

  useEffect(() => { recharger(); }, [recharger]);

  // Rien à afficher tant qu'on ne sait pas, ou quand tout va bien.
  if (!charge || (aRelancer.length === 0 && demandes.length === 0)) return null;

  // Le temps qu'il reste, dit en clair : c'est ce qui rend un message de
  // relance convaincant.
  const reste = tempsRestant(week?.cutoffAt);

  return (
    <div className="border-b border-[var(--border)] bg-[var(--paper)]">
      <button
        type="button"
        onClick={() => setDeplie((v) => !v)}
        aria-expanded={deplie}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left motion-tap"
      >
        <AlertCircle size={16} className="shrink-0 text-[var(--signal)]" aria-hidden="true" />
        <span className="text-sm font-bold text-[color:var(--ink)]">
          {aRelancer.length > 0 ? r.titre : t.delais.enAttente(demandes.length)}
        </span>
        {aRelancer.length > 0 && (
          <span className="rounded-full bg-[var(--signal)]/15 px-2 py-0.5 text-xs font-bold text-[var(--signal)] tabular-nums">
            {aRelancer.length}
          </span>
        )}
        {demandes.length > 0 && aRelancer.length > 0 && (
          <span className="text-xs text-[color:var(--muted)]">
            · {t.delais.enAttente(demandes.length)}
          </span>
        )}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="ml-auto shrink-0 text-[color:var(--muted)] transition-transform"
          style={{ transform: deplie ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
      </button>

      {deplie && (
        <div className="border-t border-[var(--border)] bg-[var(--paper-2)] px-4 py-3 motion-enter">
          {aRelancer.length > 0 && (
            <>
              <p className="mb-2.5 text-xs text-[color:var(--muted)]">{r.sous}</p>
              <ul className="flex flex-wrap gap-2">
                {aRelancer.map((pays) => {
                  const numero = String(pays.phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
                  const message = r.message(pays.nom, reste);
                  return (
                    <li key={pays.countryId}>
                      {numero ? (
                        <a
                          href={`https://wa.me/${numero}?text=${encodeURIComponent(message)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 px-3 py-1.5 text-xs font-semibold text-[#25D366] transition-colors hover:bg-[#25D366]/20"
                        >
                          <MessageCircle size={13} aria-hidden="true" />
                          {pays.nom}
                        </a>
                      ) : (
                        // Sans numéro, le bouton mentirait : il ouvrirait
                        // WhatsApp sur rien.
                        <span
                          title={r.sansNumero}
                          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)]"
                        >
                          {pays.nom} · {r.sansNumero}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {aRelancer.length === 0 && (
            <p className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
              <Check size={14} aria-hidden="true" /> {r.aucun}
            </p>
          )}

          {demandes.length > 0 && (
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <p className="mb-1.5 text-xs font-bold text-[color:var(--ink)]">
                {t.delais.enAttente(demandes.length)}
              </p>
              <ul className="flex flex-wrap gap-2">
                {demandes.map((d) => (
                  <li
                    key={d.countryId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--paper)] px-3 py-1.5 text-xs text-[color:var(--ink)]"
                  >
                    <Clock size={13} aria-hidden="true" className="text-[color:var(--muted)]" />
                    {d.nom}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** « 6 h », « 40 min », ou une chaîne vide si la clôture est passée. */
function tempsRestant(cutoffAt) {
  if (!cutoffAt) return '';
  const restant = new Date(cutoffAt).getTime() - Date.now();
  if (!Number.isFinite(restant) || restant <= 0) return '';
  const heures = Math.floor(restant / 3600000);
  if (heures >= 1) return `${heures} h`;
  return `${Math.max(1, Math.round(restant / 60000))} min`;
}
