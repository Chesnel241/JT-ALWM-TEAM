/**
 * Contact support unique de la plateforme (WhatsApp). Centralisé ici pour que
 * le numéro ne soit plus recopié dans chaque écran : login, bouton d'aide
 * flottant et accueil journalistes pointent tous vers le même contact.
 */

export const SUPPORT_WHATSAPP_NUMBER = '33778669907';

/** Lien wa.me pré-rempli avec le message donné. */
export function whatsappSupportLink(message) {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message || '')}`;
}
