import { Video, Mic, Image as ImageIcon, FileText, Check } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { splitByMediaType } from '../lib/mediaTypes.js';

/**
 * Ce qu'un reportage doit contenir, et ce qui est déjà arrivé.
 *
 * La liste des fichiers envoyés ne répond pas à la question que se pose le
 * correspondant avant de fermer l'application : « est-ce que j'ai tout
 * envoyé ? ». Quatre pastilles y répondent d'un coup d'œil, sans lecture.
 *
 * Rien n'est bloqué ni obligatoire : un reportage peut légitimement n'avoir
 * ni image ni son séparé. C'est un pense-bête, pas une validation.
 */
const ITEMS = [
  { key: 'video', Icon: Video },
  { key: 'audio', Icon: Mic },
  { key: 'image', Icon: ImageIcon },
  { key: 'document', Icon: FileText },
];

export default function ReportageChecklist({ files = [] }) {
  const { t } = useI18n();
  const byType = splitByMediaType(files);
  const labels = t.uploader.checklistItems;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-3.5">
      <p className="text-xs font-bold text-[color:var(--ink)] mb-2.5">
        {t.uploader.checklistTitle}
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {ITEMS.map(({ key, Icon }) => {
          const count = (byType[key] || []).length;
          const done = count > 0;
          return (
            <li
              key={key}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-2 border ${
                done
                  ? 'border-[var(--success)]/40 bg-[var(--success)]/10'
                  : 'border-[var(--border)] bg-[var(--paper-2)]'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  done ? 'bg-[var(--success)] text-white' : 'bg-[var(--paper)] text-[color:var(--muted)]'
                }`}
              >
                {done ? <Check size={15} strokeWidth={3} /> : <Icon size={15} />}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-[color:var(--ink)] truncate">
                  {labels[key]}
                </span>
                <span className="block text-[11px] text-[color:var(--muted)]">
                  {done ? t.uploader.checklistCount(count) : t.uploader.checklistMissing}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
