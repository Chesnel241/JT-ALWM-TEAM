import { MessageCircle } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';

const WHATSAPP_NUMBER = '33778669907';

export default function HelpButton() {
  const { t } = useI18n();
  const cta = t.help?.cta || 'Besoin d\'aide ?';
  const message = t.help?.message || 'Bonjour, j\'ai besoin d\'aide sur la plateforme JT ALWM.';
  const aria = t.help?.aria || 'Contacter le support sur WhatsApp';
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={aria}
      className="fixed bottom-24 sm:bottom-5 left-4 sm:left-5 z-50 group flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white pl-4 pr-5 py-3 rounded-full shadow-lg hover:shadow-xl transition-all"
    >
      <MessageCircle size={22} className="flex-shrink-0" />
      <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">
        {cta}
      </span>
    </a>
  );
}
