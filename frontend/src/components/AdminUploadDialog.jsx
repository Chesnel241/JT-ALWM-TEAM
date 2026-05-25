import { useState, useRef } from 'react';
import { UploadCloud, X, Lock } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function AdminUploadDialog({ isOpen, onClose, onUpload, isLoading, countryName }) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (file && password) {
      onUpload(file, password);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-[var(--paper)] rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-[var(--border)]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--paper-2)]">
          <h2 className="text-lg font-bold text-[color:var(--ink)] flex items-center gap-2">
            <UploadCloud size={20} className="text-[color:var(--accent)]" />
            Upload Reportage Assemblé
          </h2>
          <button onClick={onClose} disabled={isLoading} className="p-1.5 rounded-lg text-[color:var(--muted)] hover:bg-[var(--paper)] transition-colors active:scale-95">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <p className="text-sm text-[color:var(--muted)] mb-5">
            Cette action réservée aux administrateurs permet d'uploader le reportage final pour <strong>{countryName}</strong>, même si le délai limite est dépassé.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[color:var(--ink)] mb-1.5">
                Sélectionnez le fichier vidéo
              </label>
              <div 
                className="border-2 border-dashed border-[var(--border)] rounded-xl p-4 text-center cursor-pointer hover:border-[var(--accent)] transition-colors bg-[var(--paper-2)]"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0])}
                />
                {file ? (
                  <div className="text-sm font-medium text-[color:var(--ink)] truncate px-2">
                    {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                  </div>
                ) : (
                  <div className="text-sm text-[color:var(--muted)]">
                    Cliquez pour choisir un fichier
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[color:var(--ink)] mb-1.5">
                Mot de passe Administrateur
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]" />
                <input
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
              className="px-4 py-2 rounded-lg font-medium text-sm border border-[var(--border)] text-[color:var(--ink)] hover:bg-[var(--paper-2)] transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading || !file || !password}
              className="px-4 py-2 rounded-lg font-medium text-sm bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Upload en cours...
                </>
              ) : (
                <>
                  <UploadCloud size={16} />
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
