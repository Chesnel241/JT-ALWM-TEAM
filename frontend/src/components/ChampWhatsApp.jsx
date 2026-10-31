import { useId } from 'react';
import PhoneInput, { isPossiblePhoneNumber } from 'react-phone-number-input';
import { CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import PhoneCountryBadge from './PhoneCountryBadge.jsx';
import 'react-phone-number-input/style.css';

/**
 * Le numéro WhatsApp du pays, et le bouton qui l'enregistre.
 *
 * Les deux écrans d'envoi (téléphone, ordinateur) avaient chacun leur champ,
 * petit, sans libellé sur téléphone, et un bouton qui restait grisé sans
 * dire pourquoi. Ici, le champ est en très grand, son libellé est visible,
 * l'indicatif est déjà rempli d'après le pays, et le champ dit en direct si
 * le numéro a le bon nombre de chiffres — en vert quand c'est bon, en
 * orange quand il en manque.
 */
export default function ChampWhatsApp({ valeur, onChange, onValider, enCours = false, paysDefaut }) {
  const { t } = useI18n();
  const u = t.uploader;
  const idChamp = useId();
  const idAide = useId();
  const saisi = String(valeur || '').replace(/\D/g, '').length >= 4;
  const possible = Boolean(valeur) && isPossiblePhoneNumber(valeur);

  return (
    <div className="space-y-3">
      <label htmlFor={idChamp} className="block text-sm font-bold text-[color:var(--ink)]">
        {u.phoneLabel}
      </label>
      <div className="jr-champ-telephone" data-etat={possible ? 'ok' : saisi ? 'incomplet' : undefined}>
        <PhoneInput
          id={idChamp}
          international
          defaultCountry={paysDefaut}
          flagComponent={PhoneCountryBadge}
          value={valeur}
          onChange={onChange}
          aria-describedby={idAide}
          autoComplete="tel"
          className="w-full uploader-phone-input"
        />
      </div>
      <p id={idAide} className="flex items-start gap-1.5 text-sm font-semibold" aria-live="polite">
        {possible ? (
          <>
            <CheckCircle2 size={18} className="shrink-0 text-[color:var(--action)]" />
            <span className="text-[color:var(--action-deep)]">{u.phoneOk}</span>
          </>
        ) : saisi ? (
          <>
            <AlertTriangle size={18} className="shrink-0 text-[color:var(--cta-orange)]" />
            <span className="text-[color:var(--cta-orange-deep)]">{u.phoneIncomplet}</span>
          </>
        ) : (
          <span className="font-medium text-[color:var(--muted)]">{u.phoneWhy}</span>
        )}
      </p>
      <button
        type="button"
        onClick={() => onValider?.()}
        disabled={enCours || !possible}
        className="jr-bouton jr-bouton-vert w-full min-h-[60px] text-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {enCours
          ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
          : <Send size={20} aria-hidden="true" />}
        <span>{u.mandatoryPhoneSubmit}</span>
      </button>
    </div>
  );
}
