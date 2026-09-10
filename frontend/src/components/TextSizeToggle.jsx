import { Type } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { TEXT_SIZES } from '../lib/textSize.js';

/**
 * Bascule « gros caractères ». Un seul bouton, deux états : le réglage doit
 * se comprendre sans être expliqué, y compris par quelqu'un qui n'a jamais
 * cherché un menu d'accessibilité.
 */
export default function TextSizeToggle({ size, onChange, compact = false }) {
  const { t } = useI18n();
  const isLarge = size === TEXT_SIZES.LARGE;
  const label = isLarge ? t.textSize.normalCta : t.textSize.largeCta;

  return (
    <button
      type="button"
      onClick={() => onChange?.(isLarge ? TEXT_SIZES.NORMAL : TEXT_SIZES.LARGE)}
      title={label}
      aria-label={label}
      aria-pressed={isLarge}
      className={`${compact ? 'h-9 w-9 justify-center p-0' : 'px-4 py-2'} text-sm font-semibold rounded-lg border transition-[transform,background-color,border-color,color] duration-150 active:scale-[0.97] flex items-center gap-2 ${
        isLarge
          ? 'bg-[var(--accent)] text-white border-[color:var(--accent)]'
          : 'bg-[var(--paper)] text-[color:var(--ink)] border-[var(--border)]'
      }`}
    >
      <Type size={compact ? 16 : 15} strokeWidth={2.4} />
      {!compact && <span>{label}</span>}
    </button>
  );
}
