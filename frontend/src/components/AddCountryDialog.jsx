import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';

const ID_RE = /^[a-z0-9-]{2,12}$/;
const CODE_RE = /^[A-Z0-9]{2,5}$/;

export default function AddCountryDialog({ isOpen, onCancel, onConfirm }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [id, setId] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setName(''); setCode(''); setId('');
      setIdTouched(false); setError(null); setIsLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!idTouched) setId(code.toLowerCase().slice(0, 12));
  }, [code, idTouched]);

  if (!isOpen) return null;

  const cleanId = id.trim().toLowerCase();
  const cleanCode = code.trim().toUpperCase();
  const cleanName = name.trim();

  const idValid = ID_RE.test(cleanId);
  const codeValid = CODE_RE.test(cleanCode);
  const nameValid = cleanName.length >= 1 && cleanName.length <= 60;
  const formValid = idValid && codeValid && nameValid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formValid) return;
    setIsLoading(true);
    setError(null);
    try {
      await onConfirm({ id: cleanId, name: cleanName, code: cleanCode });
    } catch (err) {
      setError(err.message || t.uploader.errorPrefix);
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-[10001] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-country-title"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--paper)] rounded-2xl shadow-lg max-w-md w-full p-6 border border-[var(--border)]"
      >
        <div className="bg-[var(--accent)]/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
          <Plus className="text-[var(--accent-deep)]" size={24} />
        </div>

        <h2
          id="add-country-title"
          className="text-lg font-semibold text-[color:var(--ink)] mb-1"
        >
          {t.addCountry.title}
        </h2>
        <p className="text-[color:var(--muted)] text-sm mb-5">
          {t.addCountry.subtitle}
        </p>

        <div className="space-y-3 mb-4">
          <div>
            <label htmlFor="add-country-name" className="block text-xs uppercase tracking-[0.15em] text-[color:var(--muted)] mb-1">
              {t.addCountry.nameLabel}
            </label>
            <input
              id="add-country-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.addCountry.namePh}
              maxLength={60}
              required
              className="w-full border border-[var(--border)] rounded-xl px-3 py-2 text-sm bg-[var(--paper)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
            />
          </div>
          <div>
            <label htmlFor="add-country-code" className="block text-xs uppercase tracking-[0.15em] text-[color:var(--muted)] mb-1">
              {t.addCountry.codeLabel}
            </label>
            <input
              id="add-country-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t.addCountry.codePh}
              maxLength={5}
              required
              className="w-full border border-[var(--border)] rounded-xl px-3 py-2 text-sm bg-[var(--paper)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] uppercase"
            />
          </div>
          <div>
            <label htmlFor="add-country-id" className="block text-xs uppercase tracking-[0.15em] text-[color:var(--muted)] mb-1">
              {t.addCountry.idLabel}
            </label>
            <input
              id="add-country-id"
              type="text"
              value={id}
              onChange={(e) => { setIdTouched(true); setId(e.target.value.toLowerCase()); }}
              placeholder={t.addCountry.idPh}
              maxLength={12}
              required
              className="w-full border border-[var(--border)] rounded-xl px-3 py-2 text-sm bg-[var(--paper)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] lowercase font-mono"
            />
            <p className="text-xs text-[color:var(--muted)] mt-1">
              {t.addCountry.idHelp}
            </p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            type="button"
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-[color:var(--ink)] hover:bg-[var(--paper-2)] transition-colors disabled:opacity-50 font-medium text-sm"
          >
            {t.addCountry.cancel}
          </button>
          <button
            type="submit"
            disabled={isLoading || !formValid}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white transition-colors disabled:opacity-50 font-medium text-sm flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t.addCountry.submitting}
              </>
            ) : (
              t.addCountry.submit
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
