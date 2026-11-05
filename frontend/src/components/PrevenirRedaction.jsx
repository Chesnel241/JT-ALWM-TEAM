import { MessageCircle } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { whatsappSupportLink } from '../lib/support.js';

/**
 * « Prévenir la rédaction » : un message WhatsApp prêt à partir.
 *
 * LE BESOIN : une fois leurs fichiers envoyés, beaucoup de correspondants
 * écrivaient quand même à la rédaction pour dire « c'est parti », en tapant
 * le message à la main sur un téléphone — souvent sans dire quel reportage.
 * Le message est maintenant écrit d'avance : pays, semaine, nombre de
 * fichiers et titre. Il n'y a plus qu'à toucher « Envoyer » dans WhatsApp.
 */
export default function PrevenirRedaction({ pays, semaine, nombre, titre, className = '' }) {
  const { t } = useI18n();
  const p = t.pratique;
  if (!nombre) return null;
  const message = p.prevenirMessage(pays, semaine, nombre, titre);
  return (
    <a
      href={whatsappSupportLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={`jr-bouton jr-bouton-vert w-full ${className}`}
    >
      <MessageCircle size={20} aria-hidden="true" />
      <span className="flex flex-col items-start leading-tight text-left">
        <span>{p.prevenir}</span>
        <span className="text-xs font-semibold opacity-90">{p.prevenirAide}</span>
      </span>
    </a>
  );
}
