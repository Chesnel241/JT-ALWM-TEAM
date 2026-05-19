import { useState, useEffect } from 'react';
import Nav from './components/Nav.jsx';
import HomeView from './components/HomeView.jsx';
import UploaderView from './components/UploaderView.jsx';
import DashboardView from './components/DashboardView.jsx';
import { api } from './api/index.js';

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [countries, setCountries] = useState([]);
  const [weeks, setWeeks] = useState([]);

  useEffect(() => {
    Promise.all([api.getCountries(), api.getWeeks()])
      .then(([c, w]) => {
        setCountries(c);
        setWeeks(w);
        const active = w.find((wk) => wk.status === 'active');
        if (active) {
          setSelectedWeek(active.id);
        } else if (w.length > 0) {
          setSelectedWeek(w[0].id);
        }
      })
      .catch(console.error);
  }, []);

  const handleSelectCountry = (country) => {
    setSelectedCountry(country);
    setCurrentView('uploader');
  };

  return (
    <div className="app-shell flex flex-col">
      <Nav currentView={currentView} setCurrentView={setCurrentView} />

      <main className="flex-1 pb-12">
        {currentView === 'home' && (
          <HomeView countries={countries} onSelectCountry={handleSelectCountry} />
        )}
        {currentView === 'uploader' && selectedCountry && (
          <UploaderView
            country={selectedCountry}
            weeks={weeks}
            selectedWeek={selectedWeek}
            setSelectedWeek={setSelectedWeek}
            onBack={() => setCurrentView('home')}
          />
        )}
        {currentView === 'dashboard' && (
          <DashboardView
            weeks={weeks}
            selectedWeek={selectedWeek}
            setSelectedWeek={setSelectedWeek}
            countries={countries}
          />
        )}
      </main>

      <footer className="bg-[var(--paper-2)] text-[color:var(--muted)] py-6 text-center text-sm border-t border-[var(--border)]">
        <p>JT ALWM Hub, outil de centralisation des reportages.</p>
        <p className="text-xs mt-2 text-[color:var(--muted)]">
          Rétention automatique : Les fichiers sont supprimés 48h après la fin de la semaine de diffusion.
        </p>
      </footer>
    </div>
  );
}
