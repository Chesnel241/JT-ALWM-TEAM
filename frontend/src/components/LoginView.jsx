import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { Lock, MessageCircle } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import { api } from '../api/index.js';

export default function LoginView({ onLogin }) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError(t.login?.required || 'Mot de passe requis');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      // Le backend valide le password ET pose un cookie httpOnly.
      // Aucun secret n'est stocké côté JS — XSS-resistant.
      await api.login(password);
      onLogin();
    } catch (err) {
      setError(err.message || t.errors?.serverError || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const whatsappUrl = `https://wa.me/33778669907?text=${encodeURIComponent(t.login?.whatsappMessage || 'Bonjour, je n\'arrive pas à accéder à la plateforme ALWM. Pouvez-vous m\'aider ?')}`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] p-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="panel p-8 max-w-md w-full border-t-4 border-t-[color:var(--accent)] text-center">
        <div className="mx-auto bg-[var(--accent)]/10 text-[color:var(--accent-deep)] w-16 h-16 rounded-full flex items-center justify-center mb-6">
          <Lock size={32} />
        </div>
        
        <h2 className="text-2xl font-bold text-[color:var(--ink)] mb-2">
          {t.nav?.brand || 'JT Access'}
        </h2>
        <p className="text-[color:var(--muted)] mb-8">
          {t.login?.instruction || 'Veuillez entrer le mot de passe global pour accéder à la plateforme.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.login?.passwordPlaceholder || 'Mot de passe'}
              className="w-full px-4 py-3 bg-[var(--paper-2)] border border-[var(--border)] rounded-xl text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)] transition-all"
              autoFocus
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className="btn btn-primary w-full py-3 disabled:opacity-50">
            {t.login?.unlock || 'Déverrouiller'}
          </button>
        </form>
      </div>

      <div className="mt-8 text-center flex flex-col items-center gap-3">
        <p className="text-sm text-[color:var(--muted)] max-w-md">
          {t.login?.contactHelp || 'Si vous n\'avez pas le mot de passe ou avez besoin d\'aide, écrivez sur WhatsApp au +33778669907'}
        </p>
        <a 
          href={whatsappUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full font-medium transition-colors shadow-sm"
        >
          <MessageCircle size={18} />
          {t.login?.whatsappButton || 'Contacter sur WhatsApp'}
        </a>
      </div>
    </div>
  );
}
