import { useState } from 'react';
import { Lock } from 'lucide-react';
import { api } from '../api/index.js';
import { saveAdminPassword } from '../lib/adminSession.js';
import { useI18n } from '../i18n/I18nContext.jsx';

/**
 * La porte d'entrée de l'espace montage, partout où elle manque.
 *
 * Le formulaire n'existait qu'à un seul endroit : à l'intérieur du tableau de
 * bord. Un monteur qui ouvrait directement la programmation, la voix off ou le
 * bloc de notification tombait sur « déverrouillez l'espace montage » sans
 * champ, sans bouton, sans rien — il devait deviner qu'il fallait passer par
 * un autre onglet, taper le mot de passe, puis revenir.
 *
 * Ce composant est cette porte. Il se pose à la place du contenu d'un écran
 * réservé, et rend la main dès que le mot de passe est reconnu.
 */
export default function AdminGate({ onDeverrouille, titre, sous }) {
  const { t } = useI18n();
  const g = t.adminGate || {};

  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const valider = async (event) => {
    event.preventDefault();
    // Même nettoyage que le reste de la plateforme : le presse-papier et la
    // saisie automatique des navigateurs glissent volontiers des espaces
    // insécables et des caractères invisibles dans un mot de passe que la
    // personne croit juste.
    const propre = motDePasse
      .normalize('NFC')
      .replace(/[	   -‍  ⁠　﻿]/g, '')
      .trim();

    if (!propre) {
      setErreur(g.erreur || 'Mot de passe incorrect');
      return;
    }

    setEnCours(true);
    setErreur('');
    try {
      const ok = await api.checkAdminPassword(propre);
      if (!ok) {
        setErreur(g.erreur || 'Mot de passe incorrect');
        return;
      }
      saveAdminPassword(propre);
      onDeverrouille?.(propre);
    } catch {
      // Réseau coupé ou serveur muet : le dire, plutôt que de laisser croire
      // que le mot de passe est faux. Les deux se corrigent différemment.
      setErreur(g.erreurReseau || 'Vérification impossible. Réessayez.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="panel p-6 sm:p-8 border-t-4 border-t-[color:var(--accent)]">
        <div className="mx-auto mb-5 h-14 w-14 rounded-full bg-[var(--accent)]/10 text-[color:var(--accent-deep)] flex items-center justify-center">
          <Lock size={26} aria-hidden="true" />
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-center text-[color:var(--ink)]">
          {titre || g.titre || 'Espace montage'}
        </h2>
        <p className="mt-2 mb-6 text-center text-sm text-[color:var(--muted)]">
          {sous || g.sous || 'Cet écran est réservé à l’équipe montage.'}
        </p>

        <form onSubmit={valider} className="space-y-4">
          <div>
            <label
              htmlFor="admin-gate-mot-de-passe"
              className="block text-sm font-medium mb-1.5 text-[color:var(--ink)]"
            >
              {g.champ || 'Mot de passe équipe montage'}
            </label>
            <input
              id="admin-gate-mot-de-passe"
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoFocus
              autoComplete="current-password"
              className="w-full px-4 py-3 bg-[var(--paper-2)] border border-[var(--border)] rounded-xl text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]"
            />
          </div>

          {erreur && <p role="alert" className="text-sm text-center text-[var(--signal)]">{erreur}</p>}

          <button type="submit" disabled={enCours} className="btn btn-primary w-full py-3 disabled:opacity-50 motion-tap">
            {enCours ? (g.enCours || 'Vérification…') : (g.valider || 'Déverrouiller')}
          </button>
        </form>
      </div>
    </div>
  );
}
