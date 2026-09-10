import { useEffect, useState } from 'react';
import { Link2, Copy, Check, MessageCircle, X, AlertCircle } from 'lucide-react';
import { api } from '../api/index.js';

/**
 * Émission du lien personnel d'un correspondant.
 *
 * Ce lien identifie la personne et son pays. Il n'ouvre aucune porte que la
 * plateforme ne laisse déjà ouverte : il sert à savoir qui a envoyé quoi, à
 * qui écrire, et qui relancer. Il n'est rendu qu'une fois, à l'écran de la
 * personne qui le demande ; le serveur ne sait pas le relire.
 */
export default function ReporterLinkDialog({ isOpen, onClose, countryId, countryName, adminPassword }) {
  const [nom, setNom] = useState('');
  const [lien, setLien] = useState('');
  const [erreur, setErreur] = useState('');
  const [busy, setBusy] = useState(false);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNom('');
    setLien('');
    setErreur('');
    setCopie(false);
  }, [isOpen, countryId]);

  if (!isOpen) return null;

  const emettre = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErreur('');
    try {
      const res = await api.createReporterLink(countryId, nom.trim(), adminPassword);
      setLien(`${window.location.origin}${res.chemin}`);
    } catch (err) {
      setErreur(err.message || 'Émission impossible.');
    } finally {
      setBusy(false);
    }
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      setErreur('Copie impossible : sélectionnez le lien à la main.');
    }
  };

  const messageWhatsApp = `Bonjour${nom ? ` ${nom}` : ''}, voici votre lien personnel pour envoyer vos reportages au JT ALWM. Gardez-le, il est à vous seul :\n${lien}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={emettre}
        className="motion-rise w-full max-w-lg bg-[var(--paper)] rounded-3xl border border-[var(--border)] p-6 space-y-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-10 w-10 shrink-0 rounded-2xl bg-[var(--accent)]/10 text-[color:var(--accent-deep)] flex items-center justify-center">
              <Link2 size={20} />
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-lg text-[color:var(--ink)] leading-snug">Lien du correspondant</h3>
              <p className="text-sm text-[color:var(--muted)]">{countryName || countryId}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="shrink-0 p-2 -m-2 rounded-full text-[color:var(--muted)] active:scale-95">
            <X size={20} />
          </button>
        </div>

        {!lien ? (
          <>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
                Nom du correspondant
              </span>
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                maxLength={60}
                placeholder="Awa Diop"
                className="w-full min-h-[48px] rounded-2xl border border-[var(--border)] bg-[var(--paper)] px-4 text-base text-[color:var(--ink)] outline-none focus:border-[color:var(--accent)]"
              />
              <span className="block text-xs text-[color:var(--muted)] leading-relaxed">
                Ce nom apparaîtra sur les sujets qu'il enverra. Vous pouvez le laisser vide.
              </span>
            </label>

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[50px] rounded-2xl bg-[var(--action)] text-white font-bold active:scale-[0.98] motion-tap disabled:opacity-45"
            >
              {busy ? 'Émission…' : 'Émettre le lien'}
            </button>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper-2)] p-3">
              <p className="text-xs font-mono break-all text-[color:var(--ink)] leading-relaxed">{lien}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copier}
                className="flex-1 min-w-[140px] min-h-[46px] rounded-2xl bg-[var(--action)] text-white font-bold text-sm inline-flex items-center justify-center gap-2 active:scale-[0.98] motion-tap"
              >
                {copie ? <Check size={17} /> : <Copy size={17} />}
                {copie ? 'Copié' : 'Copier le lien'}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(messageWhatsApp)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[140px] min-h-[46px] rounded-2xl bg-[#25D366] text-white font-bold text-sm inline-flex items-center justify-center gap-2 active:scale-95 motion-tap"
              >
                <MessageCircle size={17} />
                Envoyer sur WhatsApp
              </a>
            </div>

            <p className="flex items-start gap-2 text-xs text-[color:var(--muted)] leading-relaxed">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              Ce lien ne sera plus affiché. Il identifie son porteur : transmettez-le à cette
              personne seule. En réémettre un n'invalide pas l'ancien.
            </p>
          </>
        )}

        {erreur && (
          <p className="flex items-start gap-2 text-sm text-[var(--signal)] leading-relaxed">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {erreur}
          </p>
        )}
      </form>
    </div>
  );
}
