import React, { useState } from 'react';

export default function CountryAvatar({ country, className = "w-10 h-10" }) {
  const [imgError, setImgError] = useState(false);
  
  if (!country || (!country.id && !country.code)) {
    return <div className={`${className} rounded-full bg-gray-200`}></div>;
  }

  const isSpecial = country.id === 'tj' || country.id === 'mj' || country.id === 'afrique';
  
  // Mapping intelligent pour corriger les codes personnalisés (ex: GB pour Gabon, RDC, DAGAN)
  const codeToIso = {
    'CM': 'cm', 'SN': 'sn', 'CI': 'ci', 'CD': 'cd', 'RDC': 'cd',
    'CG': 'cg', 'CB': 'cg', 'DAGAN': 'cg', 'MA': 'ma', 'TG': 'tg',
    'BJ': 'bj', 'BF': 'bf', 'GB': 'ga', 'GA': 'ga', 'UG': 'ug',
    'TD': 'td', 'GH': 'gh', 'DP': 'un'
  };
  
  const isoCode = (country.code && codeToIso[country.code.toUpperCase()]) 
    ? codeToIso[country.code.toUpperCase()] 
    : (country.id || '').toLowerCase();
  
  const isAfrique = country.name && (country.name.toLowerCase().trim() === 'afrique' || country.name.toLowerCase().trim() === 'bureau afrique' || country.id === 'afrique');

  if (isAfrique) {
    return (
      <div className={`${className} rounded-full overflow-hidden shrink-0 border border-black/10 shadow-sm bg-[var(--paper)] flex items-center justify-center`}>
        <img 
          src="/afrique.svg"
          alt="Afrique"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (isSpecial || imgError) {
    return (
       <div className={`${className} rounded-full flex items-center justify-center font-semibold shrink-0 ${
          country.id === 'tj' || country.id === 'mj'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
            : 'bg-[var(--accent)]/15 text-[color:var(--accent-deep)]'
        }`}>
          <span className="text-sm">{country.code}</span>
       </div>
    );
  }

  return (
    <div className={`${className} rounded-full overflow-hidden shrink-0 border border-black/10 shadow-sm bg-[var(--paper)] flex items-center justify-center`}>
      <img 
        src={`https://cdnjs.cloudflare.com/ajax/libs/flag-icons/7.2.1/flags/4x3/${isoCode}.svg`}
        alt={country.name}
        className="w-full h-full object-cover"
        onError={(e) => {
          console.error(`Failed to load flag for ${isoCode}`);
          setImgError(true);
        }}
      />
    </div>
  );
}
