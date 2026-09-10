import { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, Download, Trash2, FileText, Mic, MessageSquare } from 'lucide-react';

export default function ActionSheet({ 
  file, 
  isOpen, 
  onClose, 
  onApprove, 
  onReject,
  onOpenFeedback,
  onDownload,
  onDownloadHref,
  onDelete,
  onViewScript,
  isAudio,
  isVideo
}) {
  const sheetRef = useRef(null);
  const [show, setShow] = useState(false);
  const [render, setRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRender(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)));
    } else {
      setShow(false);
      const timer = setTimeout(() => setRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!render || !file) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-end justify-center sm:items-center p-4">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div 
        ref={sheetRef}
        className={`relative w-full max-w-md bg-[var(--paper)] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[var(--border)] overflow-hidden flex flex-col motion-enter transform ${
          show ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-full sm:translate-y-0 sm:scale-95 opacity-0'
        }`}
      >
        <div className="p-4 border-b border-[var(--border)] flex flex-col items-center">
          <div className="w-12 h-1.5 bg-[var(--border)] rounded-full mb-3 sm:hidden" />
          <h3 className="font-bold text-base text-[color:var(--ink)] text-center line-clamp-1 break-all">
            {file.name}
          </h3>
          <span className="text-xs text-[color:var(--muted)] mt-0.5">
            {file.size || 'Options du rush'}
          </span>
        </div>

        <div className="flex flex-col p-2 space-y-1">
          {!isVideo && (
            <button
              onClick={() => { onClose(); onViewScript(file); }}
              className="flex items-center gap-3.5 w-full p-3 rounded-2xl hover:bg-[var(--paper-2)] transition-colors active:scale-[0.98] text-left"
            >
              <div className="p-2.5 bg-blue-100 text-blue-600 dark:bg-blue-900/40 rounded-xl">
                {isAudio ? <Mic size={20} /> : <FileText size={20} />}
              </div>
              <span className="font-semibold text-[color:var(--ink)] text-sm">
                {isAudio ? "Écouter / Voir détails" : "Lire le script"}
              </span>
            </button>
          )}

          {/* Main WhatsApp Feedback / Rejection Action */}
          <button
            onClick={() => { onClose(); onReject ? onReject() : onOpenFeedback && onOpenFeedback(); }}
            className="flex items-center gap-3.5 w-full p-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors active:scale-[0.98] text-left"
          >
            <div className="p-2.5 bg-red-500 text-white rounded-xl shadow-sm">
              <MessageSquare size={20} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm">Refuser & Notifier sur WhatsApp</span>
              <span className="text-[11px] opacity-80">Rédiger un motif et ouvrir WhatsApp</span>
            </div>
          </button>

          <button
            onClick={() => { onClose(); onApprove(); }}
            className="flex items-center gap-3.5 w-full p-3 rounded-2xl hover:bg-[var(--paper-2)] transition-colors active:scale-[0.98] text-left"
          >
            <div className="p-2.5 bg-green-100 text-green-600 dark:bg-green-900/40 rounded-xl">
              <CheckCircle size={20} />
            </div>
            <span className="font-semibold text-green-700 dark:text-green-400 text-sm">Valider / Approuver le rush</span>
          </button>

          {onDownloadHref ? (
            <a
              href={onDownloadHref}
              download={file.name}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex items-center gap-3.5 w-full p-3 rounded-2xl hover:bg-[var(--paper-2)] transition-colors active:scale-[0.98] text-left"
            >
              <div className="p-2.5 bg-gray-100 text-gray-700 rounded-xl dark:bg-gray-800 dark:text-gray-300">
                <Download size={20} />
              </div>
              <span className="font-semibold text-[color:var(--ink)] text-sm">Télécharger</span>
            </a>
          ) : (
            <button
              onClick={() => { onClose(); onDownload(); }}
              className="flex items-center gap-3.5 w-full p-3 rounded-2xl hover:bg-[var(--paper-2)] transition-colors active:scale-[0.98] text-left"
            >
              <div className="p-2.5 bg-gray-100 text-gray-700 rounded-xl dark:bg-gray-800 dark:text-gray-300">
                <Download size={20} />
              </div>
              <span className="font-semibold text-[color:var(--ink)] text-sm">Télécharger</span>
            </button>
          )}

          <button
            onClick={() => { onClose(); onDelete(); }}
            className="flex items-center gap-3.5 w-full p-3 rounded-2xl hover:bg-[var(--paper-2)] transition-colors active:scale-[0.98] text-left border-t border-[var(--border)] pt-3 mt-1"
          >
            <div className="p-2.5 bg-red-50 text-red-500 rounded-xl dark:bg-red-900/20">
              <Trash2 size={20} />
            </div>
            <span className="font-semibold text-red-600 text-sm">Supprimer le fichier</span>
          </button>
        </div>
      </div>
    </div>
  );
}
