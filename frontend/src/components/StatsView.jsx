import { useState, useEffect } from 'react';
import { api } from '../api/index.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { Lock, Clock, CheckCircle, BarChart2 } from 'lucide-react';
import { formatAbsolute } from '../lib/dates.js';

export default function StatsView({ weeks, selectedWeek }) {
  const { lang } = useI18n();
  const [adminPassword, setAdminPassword] = useState('');
  const [isAuthenticatedAdmin, setIsAuthenticatedAdmin] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');
  
  const [statsData, setStatsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');
    try {
      const ok = await api.checkAdminPassword(adminPassword);
      if (ok) {
        setIsAuthenticatedAdmin(true);
      } else {
        setAuthError('Mot de passe incorrect');
      }
    } catch (err) {
      setAuthError(err.message || 'Erreur de connexion');
    } finally {
      setIsAuthenticating(false);
    }
  };
  
  const loadStats = async () => {
    setIsLoading(true);
    try {
      const data = await api.getStats(adminPassword);
      setStatsData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (isAuthenticatedAdmin) {
      loadStats();
    }
  }, [isAuthenticatedAdmin, selectedWeek]);
  
  const handleApprove = async (countryId, minutes) => {
    try {
      await api.approveDelay(selectedWeek, countryId, minutes, adminPassword);
      loadStats();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'approbation du délai");
    }
  };
  
  const handleGlobalDelay = async (minutes) => {
    try {
      await api.setGlobalDelay(selectedWeek, minutes, adminPassword);
      loadStats();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la définition du délai global');
    }
  };
  
  if (!isAuthenticatedAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-[var(--paper)] rounded-2xl shadow-sm border border-[var(--border)]">
        <h2 className="text-2xl font-bold text-center mb-6 text-[color:var(--ink)] flex items-center justify-center gap-2">
          <Lock size={24} /> Espace Statistiques & Délais
        </h2>
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[color:var(--ink)]">Mot de passe équipe montage</label>
            <input
              type="password"
              className="w-full bg-[var(--paper-2)] border border-[var(--border)] rounded-lg px-4 py-2 focus:ring-2 focus:ring-[var(--accent)] text-[color:var(--ink)]"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
          </div>
          {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
          <button
            type="submit"
            disabled={isAuthenticating}
            className="w-full btn btn-primary flex justify-center py-2"
          >
            {isAuthenticating ? 'Vérification...' : 'Déverrouiller'}
          </button>
        </form>
      </div>
    );
  }
  
  const currentDelays = statsData?.delaysByWeek?.[selectedWeek] || { global: null, requests: {} };
  const requests = Object.entries(currentDelays.requests || {});
  
  const lateStats = statsData?.lateUploadsByCountry || {};
  const sortedLateStats = Object.entries(lateStats).sort((a, b) => b[1] - a[1]);
  
  // Extension stats
  const extensionStats = statsData?.extensionsByCountry || {};
  const sortedExtensionStats = Object.entries(extensionStats).sort((a, b) => b[1] - a[1]);
  
  const maxLate = sortedLateStats[0]?.[1] || 1;
  const maxExt = sortedExtensionStats[0]?.[1] || 1;
  
  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[color:var(--ink)] flex items-center gap-3">
          <BarChart2 className="text-[var(--accent)]" size={32} />
          Statistiques & Délais
        </h1>
        <button onClick={loadStats} className="btn bg-[var(--paper-2)] text-[color:var(--ink)] border border-[var(--border)]">
          Rafraîchir
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="panel p-6">
            <h2 className="text-xl font-bold text-[color:var(--ink)] mb-4 flex items-center gap-2">
              <Clock className="text-amber-500" /> Gestion des Délais ({selectedWeek})
            </h2>
            
            <div className="mb-6 pb-6 border-b border-[var(--border)]">
              <h3 className="font-semibold text-[color:var(--ink)] mb-3">Délai Global (Tous les pays)</h3>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => handleGlobalDelay(60)} className="btn bg-[var(--paper-2)] border-[var(--border)] hover:bg-[var(--accent)] hover:text-white transition-colors">+ 1h</button>
                <button onClick={() => handleGlobalDelay(180)} className="btn bg-[var(--paper-2)] border-[var(--border)] hover:bg-[var(--accent)] hover:text-white transition-colors">+ 3h</button>
                <button onClick={() => handleGlobalDelay(720)} className="btn bg-[var(--paper-2)] border-[var(--border)] hover:bg-[var(--accent)] hover:text-white transition-colors">+ 12h</button>
              </div>
              {currentDelays.global?.extendedUntil && (
                <p className="mt-2 text-sm text-[color:var(--muted)] flex items-center gap-1">
                  <CheckCircle size={14} className="text-[var(--accent)]" /> 
                  Actif jusqu'au {formatAbsolute(currentDelays.global.extendedUntil, lang)}
                </p>
              )}
            </div>
            
            <div>
              <h3 className="font-semibold text-[color:var(--ink)] mb-4">Demandes des pays</h3>
              {requests.length === 0 ? (
                <p className="text-sm text-[color:var(--muted)]">Aucune demande de délai pour cette semaine.</p>
              ) : (
                <div className="space-y-4">
                  {requests.map(([countryId, req]) => (
                    <div key={countryId} className="bg-[var(--paper-2)] p-4 rounded-xl border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-[color:var(--ink)] text-lg uppercase tracking-wider">{countryId}</div>
                        <div className="text-sm text-[color:var(--muted)] mt-1">
                          Statut : <span className={`font-medium ${req.status === 'approved' ? 'text-[var(--accent)]' : 'text-amber-500'}`}>
                            {req.status === 'approved' ? 'Validé' : 'En attente'}
                          </span>
                        </div>
                        {req.extendedUntil && (
                          <div className="text-xs text-[color:var(--muted)] mt-1">
                            Jusqu'au : {formatAbsolute(req.extendedUntil, lang)}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <button onClick={() => handleApprove(countryId, 60)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">+ 1h</button>
                        <button onClick={() => handleApprove(countryId, 180)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">+ 3h</button>
                        <button onClick={() => handleApprove(countryId, 720)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">+ 12h</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="panel p-6">
            <h2 className="text-xl font-bold text-[color:var(--ink)] mb-6">Palmarès des Délais Demandés (Global)</h2>
            {sortedExtensionStats.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)]">Aucune donnée disponible.</p>
            ) : (
              <div className="space-y-4">
                {sortedExtensionStats.map(([countryId, count]) => (
                  <div key={countryId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold uppercase text-[color:var(--ink)]">{countryId}</span>
                      <span className="text-[color:var(--muted)] font-medium">{count} demande{count > 1 ? 's' : ''}</span>
                    </div>
                    <div className="w-full bg-[var(--paper-2)] rounded-full h-3">
                      <div
                        className="bg-amber-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${(count / maxExt) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="panel p-6">
            <h2 className="text-xl font-bold text-[color:var(--ink)] mb-6">Fichiers postés en retard (Global)</h2>
            {sortedLateStats.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)]">Aucune donnée disponible.</p>
            ) : (
              <div className="space-y-4">
                {sortedLateStats.map(([countryId, count]) => (
                  <div key={countryId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold uppercase text-[color:var(--ink)]">{countryId}</span>
                      <span className="text-[color:var(--muted)] font-medium">{count} fichier{count > 1 ? 's' : ''}</span>
                    </div>
                    <div className="w-full bg-[var(--paper-2)] rounded-full h-3">
                      <div
                        className="bg-[var(--signal)] h-3 rounded-full transition-all duration-500"
                        style={{ width: `${(count / maxLate) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
