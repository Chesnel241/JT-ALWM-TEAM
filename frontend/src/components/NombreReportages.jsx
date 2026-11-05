import { useId, useState } from 'react';
import { ChevronDown, Pencil } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';

/**
 * « Combien de reportages envoyez-vous cette semaine ? »
 *
 * POURQUOI CE CHOIX EST MIS EN AVANT
 * ----------------------------------
 * Le parcours d'avant ouvrait une section « Reportage 1 » et plaçait, sous les
 * onglets, un bouton « Ajouter un reportage ». Plusieurs correspondants ne
 * comprenaient pas qu'il fallait s'en servir pour chaque sujet supplémentaire,
 * et déposaient tout dans le premier. Le nombre se choisit maintenant
 * d'abord, en un geste, et il reste visible ensuite.
 *
 * Cinq boutons plutôt qu'une liste déroulante : les valeurs se voient d'un
 * coup et se touchent d'un pouce. Chacun est une action — il ouvre la feuille
 * des titres — et porte `aria-pressed` pour dire lequel est retenu.
 *
 * Tant que rien n'est choisi, la carte est l'étape 1 de l'écran : bordure
 * d'accent, pastille numérotée, consigne « Commencez ici ». Une fois les
 * reportages nommés, elle se replie en une ligne — « 2 reportages ·
 * Changer le nombre » : ouverte, elle repoussait le bouton d'envoi sous la
 * ligne de flottaison du téléphone pour une décision déjà prise.
 */
export default function NombreReportages({ etat, onChoisir, onModifierTitres, disabled = false, max = 5 }) {
  const { t } = useI18n();
  const titreId = useId();
  const { nommes, actuel, minimum } = etat;
  // L'étape reste à faire tant que les reportages n'ont pas de titre — même si
  // des fichiers ont déjà été déposés dans « Reportage 1 ». C'est justement le
  // correspondant qui a commencé sans choisir qui doit voir la consigne.
  const aDecider = !nommes;
  const [deplie, setDeplie] = useState(false);

  if (!aDecider && !deplie) {
    return (
      <section aria-labelledby={titreId} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--paper)] border border-[var(--border)] px-4 py-2 shadow-sm">
        <h2 id={titreId} className="font-bold text-sm text-[color:var(--ink)]">
          {t.uploader.nbReportagesOption(actuel)}
        </h2>
        <button
          type="button"
          aria-expanded="false"
          onClick={() => setDeplie(true)}
          className="inline-flex min-h-[44px] items-center gap-1 px-1 text-sm font-bold text-[color:var(--accent-deep)] underline underline-offset-2"
        >
          {t.uploader.nbReportagesChanger}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={titreId}
      className={`rounded-3xl p-4 space-y-3 motion-enter ${
        aDecider
          ? 'bg-[var(--paper)] border-2 border-[color:var(--accent)] shadow-md'
          : 'bg-[var(--paper)] border border-[var(--border)] shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        {aDecider && (
          <span
            aria-hidden="true"
            className="w-8 h-8 shrink-0 rounded-full bg-[var(--accent)] text-white font-extrabold text-sm flex items-center justify-center"
          >
            1
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id={titreId} className="font-bold text-base text-[color:var(--ink)] leading-snug">
            {t.uploader.reportageCountTitle}
          </h2>
          <p className="mt-0.5 text-xs text-[color:var(--muted)] leading-relaxed">
            {aDecider ? t.uploader.nbReportagesStart : t.uploader.nbReportagesChange}
          </p>
        </div>
        {!aDecider && (
          <button
            type="button"
            aria-expanded="true"
            onClick={() => setDeplie(false)}
            className="shrink-0 min-h-[44px] px-1 text-sm font-bold text-[color:var(--accent-deep)] underline underline-offset-2"
          >
            {t.uploader.nbReportagesReplier}
          </button>
        )}
      </div>

      <div role="group" aria-labelledby={titreId} className="grid grid-cols-5 gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const retenu = n === actuel;
          const impossible = disabled || n < minimum;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={retenu}
              aria-label={t.uploader.nbReportagesOption(n)}
              disabled={impossible}
              onClick={() => onChoisir(n)}
              className={`min-h-[56px] rounded-2xl text-xl font-extrabold motion-tap active:scale-95 disabled:opacity-35 disabled:active:scale-100 ${
                retenu
                  ? 'bg-[var(--accent)] text-white shadow-md'
                  : 'bg-[var(--paper-2)] text-[color:var(--ink)] border-2 border-[var(--border)]'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>

      {minimum > 1 && (
        <p className="text-[11px] text-[color:var(--muted)]">{t.uploader.nbReportagesMin(minimum)}</p>
      )}

      {nommes && onModifierTitres && (
        <button
          type="button"
          onClick={onModifierTitres}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold text-[color:var(--accent-deep)] bg-[var(--accent)]/10 active:scale-95 disabled:opacity-45"
        >
          <Pencil size={13} aria-hidden="true" />
          {t.uploader.nbReportagesEditTitles}
        </button>
      )}
    </section>
  );
}
