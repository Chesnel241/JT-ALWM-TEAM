import { useState, useRef, useEffect } from 'react';
import { UploadCloud, X, Lock } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function AdminUploadDialog({ isOpen, onClose, onUpload, isLoading, countryName }) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const focusableElements = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    if (dialogRef.current) {
      const focusableElements = dialogRef.current.querySelectorAll('input, button');
      if (focusableElements.length > 0) {
        // Find first input, else first button
        const firstInput = Array.from(focusableElements).find(el => el.tagName === 'INPUT' && !el.classList.contains('hidden'));
        if (firstInput) {
          firstInput.focus();
        } else {
          focusableElements[0].focus();
        }
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (file && password) {
      onUpload(file, password);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[10001] p-4" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title">
      <div ref={dialogRef} className="bg-[var(--paper)] rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-[var(--border)]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--paper-2)]">
          <h2 id="admin-dialog-title" className="text-lg font-bold text-[color:var(--ink)] flex items-center gap-2">
            <UploadCloud size={20} className="text-[color:var(--accent)]" aria-hidden="true" />
            Upload Reportage Assemblé
          </h2>
          <button onClick={onClose} disabled={isLoading} aria-label="Fermer" className="p-1.5 rounded-lg text-[color:var(--muted)] hover:bg-[var(--paper)] transition-colors active:scale-95 focus-ring focus:outline-none">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <p className="text-sm text-[color:var(--muted)] mb-5">
            Cette action réservée aux administrateurs permet d'uploader le reportage final pour <strong>{countryName}</strong>, même si le délai limite est dépassé.
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="admin-file-upload" className="block text-sm font-semibold text-[color:var(--ink)] mb-1.5">
                Sélectionnez le fichier vidéo
              </label>
              <div 
                className="border-2 border-dashed border-[var(--border)] rounded-xl p-4 text-center cursor-pointer hover:border-[var(--accent)] transition-colors bg-[var(--paper-2)] focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-2"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label="Sélectionner le fichier vidéo"
              >
                <input 
                  id="admin-file-upload"
                  type="file" 
                  ref={fileInputRef}
                  className="sr-only" 
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0])}
                  tabIndex={-1}
                />
                {file ? (
                  <div className="text-sm font-medium text-[color:var(--ink)] truncate px-2">
                    {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                  </div>
                ) : (
                  <div className="text-sm text-[color:var(--muted)]">
                    Cliquez ou appuyez sur Entrée pour choisir un fichier
                  </div>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-semibold text-[color:var(--ink)] mb-1.5">
                Mot de passe Administrateur
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" aria-hidden="true" />
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[var(--paper)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[color:var(--ink)]"
                  placeholder="Requis pour valider"
                  required
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg font-medium text-sm border border-[var(--border)] text-[color:var(--ink)] hover:bg-[var(--paper-2)] transition-colors disabled:opacity-50 focus-ring focus:outline-none"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading || !file || !password}
              className="px-4 py-2 rounded-lg font-medium text-sm bg-[var(--accent)] text-[var(--paper)] hover:bg-[var(--accent-deep)] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 focus-ring focus:outline-none"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[var(--paper)]/30 border-t-[var(--paper)] rounded-full animate-spin" aria-hidden="true" />
                  <span className="sr-only">Chargement</span>
                  Upload en cours...
                </>
              ) : (
                <>
                  <UploadCloud size={16} aria-hidden="true" />
                  Valider et Uploader
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
