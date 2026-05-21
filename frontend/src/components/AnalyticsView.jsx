import { useState, useEffect } from 'react';
import { api } from '../api/index.js';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { BarChart3, HardDrive, FileVideo, Activity, ArrowLeft } from 'lucide-react';
import SkeletonCard from './SkeletonCard.jsx';

export default function AnalyticsView({ onBack }) {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getAnalytics()
      .then(setData)
      .catch((err) => {
        console.error(err);
        addToast(err.message, 'error', 3000);
      })
      .finally(() => setLoading(false));
  }, [addToast]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} type="button" className="btn btn-ghost border border-[var(--border)]">
          <ArrowLeft size={16} /> Retour
        </button>
        <h2 className="text-3xl md:text-4xl font-semibold text-[color:var(--ink)] flex items-center gap-3">
          <BarChart3 className="text-[color:var(--accent-deep)]" size={32} />
          Statistiques Globales
        </h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <SkeletonCard count={3} />
        </div>
      ) : !data ? (
        <div className="text-center text-[color:var(--muted)] p-12 panel">
          Impossible de charger les statistiques.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="panel p-6 bg-gradient-to-br from-[var(--paper)] to-[var(--paper-2)] border-l-4 border-l-blue-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <FileVideo size={20} />
                </div>
                <h3 className="text-[color:var(--muted)] font-medium">Total Fichiers</h3>
              </div>
              <p className="text-4xl font-bold text-[color:var(--ink)]">{data.totalFiles}</p>
            </div>

            <div className="panel p-6 bg-gradient-to-br from-[var(--paper)] to-[var(--paper-2)] border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <HardDrive size={20} />
                </div>
                <h3 className="text-[color:var(--muted)] font-medium">Volume Total</h3>
              </div>
              <p className="text-4xl font-bold text-[color:var(--ink)]">{(data.totalBytes / (1024 * 1024)).toFixed(2)} MB</p>
            </div>

            <div className="panel p-6 bg-gradient-to-br from-[var(--paper)] to-[var(--paper-2)] border-l-4 border-l-purple-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <Activity size={20} />
                </div>
                <h3 className="text-[color:var(--muted)] font-medium">Pays Actifs</h3>
              </div>
              <p className="text-4xl font-bold text-[color:var(--ink)]">{Object.keys(data.filesByCountry).length}</p>
            </div>
          </div>

          <div className="panel p-6">
            <h3 className="text-xl font-semibold text-[color:var(--ink)] mb-6">Répartition par Pays</h3>
            {Object.keys(data.filesByCountry).length === 0 ? (
              <p className="text-[color:var(--muted)] text-sm">Aucune donnée disponible pour le moment.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(data.filesByCountry)
                  .sort(([, a], [, b]) => b - a)
                  .map(([countryId, count]) => {
                    const percentage = Math.round((count / data.totalFiles) * 100);
                    return (
                      <div key={countryId} className="flex items-center gap-4">
                        <span className="w-16 font-bold text-[color:var(--ink)] uppercase">{countryId}</span>
                        <div className="flex-1 h-4 bg-[var(--paper-2)] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[color:var(--accent)] rounded-full transition-all duration-500" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-sm font-medium text-[color:var(--muted)]">{count}</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
