import { useEffect, useId, useState } from 'react';
import PhoneInput, { isPossiblePhoneNumber } from 'react-phone-number-input';
import { MessageCircle } from 'lucide-react';
import { usePiegeFocus } from '../hooks/usePiegeFocus.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { phoneCountryFor } from '../lib/phone.js';
import { api } from '../api/index.js';
import PhoneCountryBadge from './PhoneCountryBadge.jsx';
import 'react-phone-number-input/style.css';

/**
 * Enregistrer le numéro WhatsApp d'un pays, depuis le tableau de bord.
 *
 * L'incident
 * ----------
 * Quand un pays n'avait pas de numéro, la colonne proposait « + Ajouter ».
 * Le bouton ouvrait la fenêtre de **refus d'un fichier**, avec un faux
 * fichier `id: 'general'` : le serveur exige un identifiant de fichier et
 * répondait 400. Le numéro n'était jamais enregistré, et le monteur ne
 * comprenait pas pourquoi « Envoyer » échouait.
 *
 * Ici, on écrit dans le carnet des contacts (`PUT /notifications/contacts`),
 * celui que lit déjà la liste de relance : le numéro vaut pour les semaines
 * suivantes, et la pastille « Écrire » apparaît aussitôt.
 */
export default function ContactPaysDialog({ ouvert, pays, adminPassword, onFermer, onEnregistre }) {
  const { t } = useI18n();
  const c = t.contactPays;
  const idTitre = useId();
  const idChamp = useId();
  const [numero, setNumero] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const boite = usePiegeFocus(ouvert, onFermer);

  // Une fenêtre rouverte pour un autre pays ne garde pas le numéro du
  // précédent.
  useEffect(() => {
    if (ouvert) {
      setNumero('');
      setErreur('');
      setEnCours(false);
    }
  }, [ouvert, pays?.id]);

  if (!ouvert || !pays) return null;

  const possible = Boolean(numero) && isPossiblePhoneNumber(numero);

  const enregistrer = async (e) => {
    e.preventDefault();
    if (!possible || enCours) return;
    setEnCours(true);
    setErreur('');
    try {
      const res = await api.setContact(pays.id, numero, adminPassword);
      onEnregistre?.({ countryId: pays.id, phone: res?.phone || numero });
    } catch {
      setErreur(c.echec);
      setEnCours(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-black/40 p-4">
      <form
        ref={boite}
        onSubmit={enregistrer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-6 shadow-lg motion-boite"
      >
        <h2 id={idTitre} className="text-lg font-semibold text-[color:var(--ink)]">
          {c.titre(pays.name)}
        </h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">{c.aide}</p>

        <label htmlFor={idChamp} className="mt-4 block text-sm font-semibold text-[color:var(--ink)]">
          {c.libelle}
        </label>
        <div className="mt-1.5 jr-champ-telephone" data-etat={possible ? 'ok' : undefined}>
          <PhoneInput
            id={idChamp}
            international
            defaultCountry={phoneCountryFor(pays.id)}
            flagComponent={PhoneCountryBadge}
            value={numero}
            onChange={(v) => setNumero(v || '')}
            autoComplete="tel"
            className="w-full uploader-phone-input"
          />
        </div>
        {erreur && (
          <p role="alert" className="mt-2 text-sm font-semibold text-[color:var(--cta-red)]">{erreur}</p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onFermer}
            className="min-h-[44px] rounded-xl border border-[var(--border)] px-4 font-semibold text-[color:var(--ink)] hover:bg-[var(--paper-2)]"
          >
            {c.annuler}
          </button>
          <button
            type="submit"
            disabled={!possible || enCours}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--action)] px-4 font-semibold text-white hover:bg-[var(--action-deep)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageCircle size={18} aria-hidden="true" />
            {enCours ? c.enCours : c.enregistrer}
          </button>
        </div>
      </form>
    </div>
  );
}
