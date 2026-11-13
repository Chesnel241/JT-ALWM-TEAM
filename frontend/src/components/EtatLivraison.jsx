import { Copy, ListVideo, Smartphone } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { tailleLisible } from '../lib/taille.js';
import { texteDuSommaire } from '../lib/sommaire.js';

/** Copier du texte, même là où l'API du presse-papiers manque. */
export async function copierTexte(texte) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch { /* on tente l'ancienne manière */ }
  try {
    const zone = document.createElement('textarea');
    zone.value = texte;
    zone.setAttribute('readonly', '');
    zone.style.position = 'fixed';
    zone.style.opacity = '0';
    document.body.appendChild(zone);
    zone.select();
    const ok = document.execCommand?.('copy');
    zone.remove();
    return Boolean(ok);
  } catch {
    return false;
  }
}

/**
 * Ce que le montage doit savoir d'un JT publié, sous son nom : où en est sa
 * version légère, et son sommaire, prêt à coller dans une description
 * YouTube ou Facebook.
 */
export default function EtatLivraison({ fichier }) {
  const { t } = useI18n();
  const d = t.delivery.etat;
  const { addToast } = useToast();
  const leger = fichier?.leger;
  const sommaire = Array.isArray(fichier?.sommaire) ? fichier.sommaire : [];
  if (!leger && sommaire.length === 0) return null;

  const copier = async () => {
    const ok = await copierTexte(texteDuSommaire(sommaire));
    addToast(ok ? d.sommaireCopie : d.sommaireNonCopie, ok ? 'success' : 'error', ok ? 4000 : 6000);
  };

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      {leger?.statut === 'pret' && (
        <span className="inline-flex items-center gap-1.5 text-[color:var(--ink)]">
          <Smartphone size={13} className="text-[color:var(--accent-deep)]" aria-hidden="true" />
          {d.legerPret(tailleLisible(leger.size))}
        </span>
      )}
      {leger?.statut === 'en_cours' && (
        <span role="status" className="inline-flex items-center gap-1.5 text-[color:var(--muted)]">
          <span className="motion-attente" aria-hidden="true" />
          {d.legerEnCours}
        </span>
      )}
      {leger?.statut === 'inutile' && <span className="text-[color:var(--muted)]">{d.legerInutile}</span>}
      {leger?.statut === 'echec' && <span className="text-[color:var(--muted)]">{d.legerEchec}</span>}
      {sommaire.length > 0 && (
        <span className="inline-flex items-center gap-1.5 text-[color:var(--muted)]">
          <ListVideo size={13} aria-hidden="true" />
          {d.parties(sommaire.length)}
          <button
            type="button"
            onClick={copier}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-1.5 font-bold text-[color:var(--accent-deep)] hover:bg-v-accent/10"
          >
            <Copy size={12} aria-hidden="true" /> {d.copier}
          </button>
        </span>
      )}
    </div>
  );
}
