import { useState, useEffect } from 'react';
import {
  X, MessageSquare, CheckCircle, AlertTriangle, HelpCircle,
  Phone, Send, Clock, FileText, Video, Mic
} from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { api } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { usePiegeFocus } from '../hooks/usePiegeFocus.jsx';

const REJECTION_PRESETS = [
  { label: '🎙️ Son saturé / inaudible', text: 'Le son est inaudible ou saturé (bruit de fond / vent). Merci de refaire la prise avec un audio plus clair.' },
  { label: '📹 Vidéo floue / instable', text: 'La qualité vidéo est floue ou les mouvements de caméra sont trop instables. Merci de renvoyer une prise stable et nette.' },
  { label: '📐 Cadrage non conforme', text: 'Le cadrage ne respecte pas les standards (sujet trop éloigné, mal centré ou coupé). Merci de corriger le cadrage.' },
  { label: '📱 Format 16:9 horizontal requis', text: 'La vidéo a été filmée en vertical ou dans un format incorrect. Le JT ALWM exige un format horizontal 16:9.' },
  { label: '📝 Script manquant', text: 'Le script ou texte de voix off correspondant à ce reportage est manquant. Merci de le renseigner dans la section Script.' },
  { label: '⏱️ Rush trop court / incomplet', text: 'Le rush envoyé est trop court ou incomplet pour couvrir le sujet. Merci de fournir des plans supplémentaires.' },
];

export default function FeedbackModal({
  isOpen,
  onClose,
  file,
  countryName,
  countryId,
  weekId,
  initialPhone,
  adminPassword,
  onStatusUpdated,
}) {
  const { addToast } = useToast();
  const [status, setStatus] = useState('rejected');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (file) {
      setStatus(file.status === 'approved' ? 'approved' : 'rejected');
      setComment(file.feedback || '');
    }
  }, [file]);

  useEffect(() => {
    if (initialPhone) {
      setPhone(initialPhone);
    } else {
      setPhone('');
    }
  }, [initialPhone]);

  // Même défaut : la boîte était annoncée modale sans l'être au clavier.
  const boiteModale = usePiegeFocus(isOpen && !!file, onClose);

  if (!isOpen || !file) return null;

  const isVideo = file.type === 'video' || /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name || file.filename || '');
  const isAudio = file.type === 'audio' || /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name || file.filename || '');

  const buildWhatsAppMessage = () => {
    const isApproved = status === 'approved';
    const statusText = isApproved ? '✅ RUSH VALIDÉ / ACCEPTÉ' : '❌ RUSH REFUSÉ / À CORRIGER';
    const decisionIntro = isApproved 
      ? "Votre rush a été vérifié et validé par l'équipe de montage pour la diffusion."
      : "Votre rush nécessite des ajustements ou une nouvelle prise.";

    let msg = `📢 *JT ALWM — Retour de l'équipe de montage*\n\n`;
    msg += `🌍 *Pays :* ${countryName || countryId} (Semaine ${weekId})\n`;
    msg += `📁 *Fichier :* ${file.name || file.filename}\n`;
    msg += `⚠️ *Décision :* ${statusText}\n\n`;
    msg += `${decisionIntro}\n\n`;

    if (comment.trim()) {
      msg += `💬 *Remarques / Instructions du monteur :*\n${comment.trim()}\n\n`;
    }

    if (!isApproved) {
      msg += `Merci de bien vouloir renvoyer une version corrigée dès que possible sur la plateforme.\n\n`;
    }

    msg += `🔗 *Accéder à la plateforme :* https://jt-alwm-team.duckdns.org`;
    return msg;
  };

  const handleApplyPreset = (presetText) => {
    if (comment.trim()) {
      setComment((prev) => `${prev}\n- ${presetText}`);
    } else {
      setComment(presetText);
    }
  };

  const saveStatusToBackend = async () => {
    const res = await api.updateFileStatus(weekId, file.id, status, comment.trim(), adminPassword);
    if (onStatusUpdated) {
      // Un seul champ, celui que le serveur stocke. Le doublon
      // `adminFeedback` n'existait que dans le navigateur : le commentaire
      // s'affichait puis disparaissait au rafraîchissement suivant.
      onStatusUpdated({
        ...file,
        status,
        feedback: comment.trim(),
      });
    }
    return res;
  };

  const handleSaveOnly = async () => {
    setIsSaving(true);
    try {
      await saveStatusToBackend();
      addToast('Statut du rush mis à jour avec succès', 'success', 3000);
      onClose();
    } catch (err) {
      addToast(`Erreur lors de la mise à jour : ${err.message}`, 'error', 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendWhatsApp = async () => {
    const rawPhone = (phone || '').replace(/[^\d+]/g, '');
    if (!rawPhone || rawPhone.length < 5) {
      addToast('Veuillez renseigner un numéro WhatsApp valide', 'warning', 4000);
      return;
    }

    setIsSaving(true);
    try {
      await saveStatusToBackend();
      
      const cleanPhone = rawPhone.replace(/^\+/, '');
      const message = buildWhatsAppMessage();
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      addToast('Statut enregistré et notification WhatsApp ouverte', 'success', 4000);
      onClose();
    } catch (err) {
      addToast(`Erreur : ${err.message}`, 'error', 4000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm motion-voile">
      <div 
        ref={boiteModale}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        className="w-full max-w-xl bg-[var(--paper)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--paper-2)]">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl text-white ${status === 'approved' ? 'bg-green-600' : 'bg-red-500'}`}>
              {status === 'approved' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            </div>
            <div>
              <h3 id="feedback-modal-title" className="font-bold text-base text-[color:var(--ink)]">
                {status === 'approved' ? 'Valider le rush' : 'Refuser / Commenter le rush'}
              </h3>
              <p className="text-xs text-[color:var(--muted)]">
                {countryName || countryId} • Semaine {weekId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-full text-[color:var(--muted)] hover:bg-[var(--paper)] hover:text-[color:var(--ink)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm flex-1">
          {/* File Card Banner */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--paper-2)] border border-[var(--border)]">
            <div className="p-2 rounded-lg bg-[var(--paper)] text-[color:var(--ink)] border border-[var(--border)]">
              {isVideo ? <Video size={18} className="text-blue-500" /> : isAudio ? <Mic size={18} className="text-purple-500" /> : <FileText size={18} className="text-amber-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs text-[color:var(--ink)] truncate" title={file.name || file.filename}>
                {file.name || file.filename}
              </p>
              <p className="text-[11px] text-[color:var(--muted)]">
                {file.size || 'Taille inconnue'} {file.reportage ? `• ${file.reportage}` : ''}
              </p>
            </div>
          </div>

          {/* Decision Status Switcher */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
              Décision de l'équipe de montage
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('approved')}
                className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 motion-tap ${
                  status === 'approved'
                    ? 'bg-green-500/15 border-green-500 text-green-600 dark:text-green-400 shadow-sm ring-1 ring-green-500/30'
                    : 'bg-[var(--paper-2)] border-[var(--border)] text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                }`}
              >
                <CheckCircle size={15} />
                <span>Rush Validé (Conforme)</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('rejected')}
                className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 motion-tap ${
                  status === 'rejected'
                    ? 'bg-red-500/15 border-red-500 text-red-600 dark:text-red-400 shadow-sm ring-1 ring-red-500/30'
                    : 'bg-[var(--paper-2)] border-[var(--border)] text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                }`}
              >
                <AlertTriangle size={15} />
                <span>Rush Refusé (À refaire)</span>
              </button>
            </div>
          </div>

          {/* WhatsApp Contact Section */}
          <div className="space-y-1.5 bg-green-500/5 p-3.5 rounded-xl border border-green-500/20">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-green-700 dark:text-green-400 flex items-center gap-1.5">
                <Phone size={13} />
                <span>Numéro WhatsApp du correspondant ({countryName || countryId})</span>
              </label>
              {phone && (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                  Enregistré
                </span>
              )}
            </div>
            <PhoneInput
              international
              defaultCountry="FR"
              value={phone}
              onChange={setPhone}
              className="w-full feedback-phone-input"
              placeholder="Ex: +241 07 00 00 00"
            />
            {!phone && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Aucun numéro n'était pré-enregistré pour ce pays. Vous pouvez le saisir manuellement ici.
              </p>
            )}
          </div>

          {/* Quick Presets for Rejection */}
          {status === 'rejected' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
                Motifs fréquents de refus (Cliquer pour insérer) :
              </label>
              <div className="flex flex-wrap gap-1.5">
                {REJECTION_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset.text)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)] hover:bg-[var(--accent)]/10 hover:border-[var(--accent)] hover:text-[color:var(--accent-deep)] transition-colors text-left"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comment / Feedback textarea */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
              {status === 'approved' ? 'Commentaire / Note (Optionnel)' : 'Instructions de correction / Motif détaillé'}
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={status === 'approved' 
                ? 'Ex: Super plan, bien cadré !' 
                : 'Ex: Le son sature au moment de l\'interview. Merci de refaire la prise audio ou de renvoyer le rush avec un son propre.'
              }
              className="w-full p-3 rounded-xl bg-[var(--paper-2)] border border-[var(--border)] text-[color:var(--ink)] text-xs focus:ring-2 focus:ring-[color:var(--accent)] outline-none resize-y"
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-[var(--border)] bg-[var(--paper-2)]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[color:var(--muted)] hover:bg-[var(--paper)] hover:text-[color:var(--ink)] transition-colors"
          >
            Annuler
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleSaveOnly}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--paper)] border border-[var(--border)] text-[color:var(--ink)] hover:bg-[var(--paper-2)] transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement…' : 'Enregistrer seul'}
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={isSaving || !phone || phone.length < 5}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#25D366] hover:bg-[#128C7E] text-white flex items-center gap-2 shadow-md motion-tap active:scale-95 disabled:opacity-50"
              title="Enregistrer le statut et ouvrir WhatsApp"
            >
              <Send size={14} />
              <span>{isSaving ? 'Traitement…' : 'Notifier sur WhatsApp'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
