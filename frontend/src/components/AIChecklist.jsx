import React, { useState, useEffect } from 'react';
import { Bot, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { API_BASE } from '../api/index.js';
import CountryAvatar from './CountryAvatar.jsx';

// Aliases pour gérer les abréviations et les fautes d'orthographe fréquentes
const ALIASES = {
  'cd': ['rdc', 'republiquedemocratiqueducongo', 'congo rdc', 'congokinshasa'],
  'cg': ['congobrazaville', 'congobrazzaville', 'congo brazaville', 'congo'],
  'ci': ['cotedivoire', 'civ'],
  'afrique': ['afrique', 'bureauafrique']
};

export default function AIChecklist({ dashboard, countries, selectedBin }) {
  const [expectedCountries, setExpectedCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Si on n'est pas sur Titres & Rappels, on ne fait rien
    if (selectedBin !== 'tj') return;

    const tjFiles = dashboard['tj'] || [];
    // Trouver le dernier fichier .txt
    const scriptFile = tjFiles
      .filter(f => f.type === 'script' || f.filename.endsWith('.txt'))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

    if (!scriptFile) {
      setExpectedCountries([]);
      return;
    }

    setLoading(true);
    setError(null);

    // On utilise le paramètre proxy pour éviter les problèmes CORS sur R2
    const url = `${API_BASE}/uploads/${scriptFile.filename}?proxy=true`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Impossible de charger le script des titres.');
        return res.text();
      })
      .then(text => {
        const detected = new Map();

        // Nettoyer les noms des pays connus (en minuscules, sans accents, sans caractères spéciaux)
        const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        
        const countryMatchers = countries.map(c => {
          const matchers = [normalize(c.name)];
          if (ALIASES[c.id]) {
            ALIASES[c.id].forEach(alias => matchers.push(normalize(alias)));
          }
          // Ajouter aussi l'id lui-même si c'est un mot valide (ex: afrique, gabon)
          if (c.id.length > 2) {
             matchers.push(normalize(c.id));
          }
          return { ...c, matchers };
        });

        // Analyser ligne par ligne
        const lines = text.split('\n');
        lines.forEach(line => {
          const l = line.trim();
          if (!l) return;

          const parts = line.split(/[:\-]/);
          const firstPart = parts[0].trim();
          const normalizedFirstPart = normalize(firstPart);
          const normalizedLine = normalize(line);
          const title = parts.length > 1 ? parts.slice(1).join(':').trim() : line;

          let matched = false;
          for (const c of countryMatchers) {
            // Ignorer tj et mj pour cette checklist
            if (c.id === 'tj' || c.id === 'mj') continue;

            for (const matchWord of c.matchers) {
               // On cherche si le nom du pays apparaît en début de ligne ou avant les ":"
               if (normalizedFirstPart === matchWord || normalizedFirstPart.includes(matchWord) || normalizedLine.startsWith(matchWord)) {
                 if (!detected.has(c.id)) {
                   // Transmettre l'objet pays complet pour que le composant CountryAvatar fonctionne correctement (avec le code)
                   detected.set(c.id, { ...c, reportages: [] });
                 }
                 detected.get(c.id).reportages.push({ title });
                 matched = true;
                 break;
               }
            }
            if (matched) break;
          }
        });

        setExpectedCountries(Array.from(detected.values()));
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [selectedBin, dashboard, countries]);

  if (selectedBin !== 'tj') return null;

  return (
    <div className="mb-6 bg-[var(--paper)] border border-[var(--accent)]/30 rounded-2xl shadow-sm overflow-hidden relative">
      <div className="absolute top-0 left-0 w-1 h-full bg-[var(--accent)]"></div>
      
      <div className="p-4 border-b border-[var(--border)] bg-[var(--accent)]/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="text-[color:var(--accent-deep)]" size={20} />
          <h3 className="font-bold text-[color:var(--ink)]">Assistant IA : Suivi des Reportages</h3>
        </div>
        {loading && <Loader2 className="animate-spin text-[color:var(--muted)]" size={16} />}
      </div>

      <div className="p-4">
        {error ? (
          <p className="text-red-500 text-sm">{error}</p>
        ) : expectedCountries.length === 0 ? (
          <p className="text-[color:var(--muted)] text-sm">
            {loading ? "Analyse du script en cours..." : "Aucun pays détecté dans le dernier script des titres. Assurez-vous d'avoir uploadé le script."}
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[color:var(--muted)] mb-2">
              D'après les titres de la semaine, voici l'état des reportages attendus :
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
              {expectedCountries.map(country => {
                // Vérifier si le pays a soumis au moins un fichier script (.txt)
                const countryFiles = dashboard[country.id] || [];
                const hasScript = countryFiles.some(f => f.type === 'script' || f.filename.endsWith('.txt'));
                
                return (
                  <div key={country.id} className={`flex flex-col p-3 rounded-xl border ${hasScript ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-100 bg-red-50/50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <CountryAvatar country={country} className="w-6 h-6" />
                        <span className="font-semibold text-sm text-[color:var(--ink)]">{country.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasScript ? (
                          <>
                            <CheckCircle size={16} className="text-emerald-500" />
                            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Reçu</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={16} className="text-red-400" />
                            <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Pas reçu</span>
                          </>
                        )}
                      </div>
                    </div>
                    {country.reportages && country.reportages.length > 0 && (
                      <div className="pl-8 space-y-1.5 mt-1 border-l-2 border-black/5 ml-3">
                        {country.reportages.map((rep, idx) => (
                          <p key={idx} className="text-[13px] text-[color:var(--muted)] leading-snug">
                            {rep.title}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
