export default function HomeView({ countries, onSelectCountry }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-10 items-start">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 badge bg-[var(--accent)]/10 text-[color:var(--accent-deep)]">
            Portail correspondants
          </div>
          <h2 className="text-4xl md:text-5xl font-semibold text-[color:var(--ink)] leading-tight">
            Uploader vos reportages sans friction et au bon endroit.
          </h2>
          <p className="text-[color:var(--muted)] text-lg max-w-xl">
            Choisissez votre pays, puis deposez videos, rushs audio et scripts. La semaine active est selectionnee par defaut.
          </p>
          <div className="panel-soft p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">Rappel</p>
              <p className="text-lg font-semibold text-[color:var(--ink)]">Chaque fichier rejoint la semaine en cours.</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-[var(--signal)]/15 flex items-center justify-center text-[color:var(--signal)] font-semibold">
              48h
            </div>
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[color:var(--ink)]">Selection du pays</h3>
            <span className="badge bg-[var(--paper)] text-[color:var(--muted)]">{countries.length} pays</span>
          </div>
          <div className="space-y-2">
            {countries.map((country, index) => (
              <button
                key={country.id}
                onClick={() => onSelectCountry(country)}
                type="button"
                aria-label={`Entrer dans ${country.name}`}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-[var(--border)] transition-all hover:shadow-[var(--shadow-soft)] ${
                  index % 2 === 0 ? 'bg-[var(--paper)]' : 'bg-[var(--paper-2)]'
                } hover:border-[color:var(--accent)]`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[var(--accent)]/15 text-[color:var(--accent-deep)] flex items-center justify-center font-semibold">
                    {country.code}
                  </div>
                  <div className="text-left">
                    <p className="text-base font-semibold text-[color:var(--ink)]">{country.name}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Correspondant</p>
                  </div>
                </div>
                <span className="text-sm text-[color:var(--muted)]">Entrer</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
