import { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, Download, Trash2, FileText, Mic } from 'lucide-react';

export default function ActionSheet({ 
  file, 
  isOpen, 
  onClose, 
  onApprove, 
  onReject, 
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
        className={`relative w-full max-w-md bg-[var(--paper)] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[var(--border)] overflow-hidden flex flex-col transition-all duration-300 transform ${
          show ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-full sm:translate-y-0 sm:scale-95 opacity-0'
        }`}
      >
        <div className="p-4 border-b border-[var(--border)] flex flex-col items-center">
          <div className="w-12 h-1.5 bg-[var(--border)] rounded-full mb-4 sm:hidden" />
          <h3 className="font-bold text-lg text-[color:var(--ink)] text-center line-clamp-1 break-all">
            {file.name}
          </h3>
        </div>

        <div className="flex flex-col p-2 space-y-1">
          {!isVideo && (
            <button
              onClick={() => { onClose(); onViewScript(file); }}
              className="flex items-center gap-4 w-full p-4 rounded-2xl hover:bg-[var(--paper-2)] transition-colors active:scale-[0.98] text-left"
            >
              <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                {isAudio ? <Mic size={24} /> : <FileText size={24} />}
              </div>
              <span className="font-semibold text-[color:var(--ink)] text-lg">
                {isAudio ? "Écouter / Voir détails" : "Lire le script"}
              </span>
            </button>
          )}

          <button
            onClick={() => { onClose(); onApprove(); }}
            className="flex items-center gap-4 w-full p-4 rounded-2xl hover:bg-[var(--paper-2)] transition-colors active:scale-[0.98] text-left"
          >
            <div className="p-3 bg-green-100 text-green-600 rounded-xl">
              <CheckCircle size={24} />
            </div>
            <span className="font-semibold text-green-700 text-lg">Approuver</span>
          </button>

          <button
            onClick={() => { onClose(); onReject(); }}
            className="flex items-center gap-4 w-full p-4 rounded-2xl hover:bg-[var(--paper-2)] transition-colors active:scale-[0.98] text-left"
          >
            <div className="p-3 bg-red-100 text-red-600 rounded-xl">
              <XCircle size={24} />
            </div>
            <span className="font-semibold text-red-700 text-lg">Rejeter</span>
          </button>

          {onDownloadHref ? (
            <a
              href={onDownloadHref}
              download={file.name}
              onClick={onClose}
              className="flex items-center gap-4 w-full p-4 rounded-2xl hover:bg-[var(--paper-2)] transition-colors active:scale-[0.98] text-left"
            >
              <div className="p-3 bg-gray-100 text-gray-700 rounded-xl dark:bg-gray-800 dark:text-gray-300">
                <Download size={24} />
              </div>
              <span className="font-semibold text-[color:var(--ink)] text-lg">Télécharger</span>
            </a>
          ) : (
            <button
              onClick={() => { onClose(); onDownload(); }}
              className="flex items-center gap-4 w-full p-4 rounded-2xl hover:bg-[var(--paper-2)] transition-colors active:scale-[0.98] text-left"
            >
              <div className="p-3 bg-gray-100 text-gray-700 rounded-xl dark:bg-gray-800 dark:text-gray-300">
                <Download size={24} />
              </div>
              <span className="font-semibold text-[color:var(--ink)] text-lg">Télécharger</span>
            </button>
          )}

          <button
            onClick={() => { onClose(); onDelete(); }}
            className="flex items-center gap-4 w-full p-4 rounded-2xl hover:bg-[var(--paper-2)] transition-colors active:scale-[0.98] text-left mt-2 border-t border-[var(--border)] pt-4"
          >
            <div className="p-3 bg-red-50 text-red-500 rounded-xl dark:bg-red-900/20">
              <Trash2 size={24} />
            </div>
            <span className="font-semibold text-red-600 text-lg">Supprimer</span>
          </button>
        </div>
      </div>
    </div>
  );
}
