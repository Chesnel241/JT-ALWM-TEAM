import { useEffect, useId, useState } from 'react';
import { BellRing, Bookmark, MessageCircle, Smartphone, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useOptionalToast } from '../hooks/useToast.jsx';
import { usePiegeFocus } from '../hooks/usePiegeFocus.jsx';
import { rappelCloture, telechargerIcs } from '../lib/agenda.js';
import { peutInstaller, suivreInstallation, installer, estAppareilApple } from '../lib/installation.js';

/**
 * Deux gestes pratiques sous l'en-tête de l'espace d'un pays.
 *
 * « Garder mon accès » : beaucoup de correspondants ne retrouvaient plus la
 * page d'une semaine à l'autre — le lien était noyé dans une conversation
 * WhatsApp. On leur propose de se l'envoyer à eux-mêmes, et d'ajouter une
 * icône sur l'écran d'accueil. Le lien partagé est l'adresse du pays, jamais
 * le jeton personnel : un secret porteur n'a rien à faire dans un message.
 *
 * « Rappel dans l'agenda » : la clôture du dimanche, chaque semaine, la
 * veille et 3 h avant, dans l'agenda du téléphone (lib/agenda.js).
 */
export default function OutilsCorrespondant({ pays, semaine }) {
  const { t } = useI18n();
  const p = t.pratique;
  const { addToast } = useOptionalToast();
  const [feuille, setFeuille] = useState(false);
  const adresse = typeof window !== 'undefined' ? `${window.location.origin}/journalistes/${pays.id}` : '';

  const poserRappel = () => {
    if (!semaine?.cutoffAt) return;
    const contenu = rappelCloture({
      cutoffAt: semaine.cutoffAt,
      paysId: pays.id,
      titre: p.agendaTitre(pays.name),
      description: p.agendaDescription(adresse),
      alarmeVeille: p.agendaVeille,
      alarme3h: p.agenda3h,
      maintenant: new Date(),
    });
    telechargerIcs(contenu, `rappel-cloture-${pays.id}.ics`);
    addToast(p.agendaPret, 'success', 6000);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button type="button" onClick={() => setFeuille(true)} className="jr-bouton jr-bouton-contour w-full text-sm">
          <Bookmark size={18} aria-hidden="true" /> {p.acces}
        </button>
        <button
          type="button"
          onClick={poserRappel}
          disabled={!semaine?.cutoffAt}
          title={p.agendaAide}
          className="jr-bouton jr-bouton-contour w-full text-sm disabled:opacity-50"
        >
          <BellRing size={18} aria-hidden="true" /> {p.agenda}
        </button>
      </div>
      <FeuilleAcces ouvert={feuille} onFermer={() => setFeuille(false)} pays={pays} adresse={adresse} />
    </>
  );
}

function FeuilleAcces({ ouvert, onFermer, pays, adresse }) {
  const { t } = useI18n();
  const p = t.pratique;
  const idTitre = useId();
  const boite = usePiegeFocus(ouvert, onFermer);
  const [installable, setInstallable] = useState(peutInstaller());
  const [aide, setAide] = useState(false);

  useEffect(() => suivreInstallation(setInstallable), []);
  useEffect(() => { if (!ouvert) setAide(false); }, [ouvert]);

  if (!ouvert) return null;

  const lienWhatsapp = `https://wa.me/?text=${encodeURIComponent(p.accesMessage(pays.name, adresse))}`;
  const ecranAccueil = async () => {
    if (installable && await installer()) { onFermer(); return; }
    setAide(true);
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onFermer}>
      <div
        ref={boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        onClick={(e) => e.stopPropagation()}
        className="motion-boite w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--paper)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={idTitre} className="text-lg font-extrabold text-[color:var(--ink)]">{p.accesTitre}</h2>
          <button type="button" onClick={onFermer} aria-label={p.fermer} className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl hover:bg-[var(--paper-2)]">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <a href={lienWhatsapp} target="_blank" rel="noopener noreferrer" className="jr-bouton jr-bouton-vert w-full">
          <MessageCircle size={20} aria-hidden="true" /> {p.accesWhatsapp}
        </a>
        <p className="-mt-2 text-sm text-[color:var(--muted)]">{p.accesWhatsappAide}</p>

        <button type="button" onClick={ecranAccueil} className="jr-bouton jr-bouton-bleu w-full">
          <Smartphone size={20} aria-hidden="true" /> {p.accesEcran}
        </button>
        {aide ? (
          <p role="status" className="-mt-2 rounded-2xl bg-[var(--accent)]/10 p-3 text-sm font-semibold text-[color:var(--ink)]">
            {estAppareilApple() ? p.accesIphone : p.accesAndroid}
          </p>
        ) : (
          <p className="-mt-2 text-sm text-[color:var(--muted)]">{p.accesEcranAide}</p>
        )}
      </div>
    </div>
  );
}
