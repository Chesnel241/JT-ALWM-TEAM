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
  
  const isAfrique = country.name && country.name.toLowerCase().includes('afrique');

  if (isAfrique) {
    return (
      <div className={`${className} rounded-full flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200/50 shadow-sm`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-[60%] h-[60%]">
          <path d="M12.98 2.05c-1.37.1-2.96.78-3.88 1.63-.73.65-1.45 1.88-1.53 2.6-.03.34-.34.75-.73.98-.84.5-1 1-.36 1.68.3.39.42.7.42 1.34 0 .56-.12 1.04-.28 1.26-.17.2-.3.64-.3 1 0 .62.56 1.76.95 1.93.2.1.53.56.73 1.06.2.5.5 1 .7 1.06.64.28.9 1.23.9 3.44 0 1.96.08 2.32.56 2.68.61.5 1.11.4 1.6-.25.56-.78 1.17-.87 2.23-.25.4.2 1 .1 1.12-.25.28-.45.84-.56 1.76-.34 1.42.34 1.84.17 1.9-1 .06-.84.14-.92.9-.59.56.25.28.48.28.78-.06.25-.34.4-.34.42.08.03.28.14.28.25 0 .11-.28.25-.28.28-.03.06.17.3.7.64.6.61.6.59 1.23-.5.62-1.29 1.48-1.79 1.48-.42 0-1.28.5-1.79 1.48-1.48.22.61-.28.98-1 .84-1.2-.4-1.65-1.12-1.4-2.57-.17-1.26-.75-2-3.18-4.1-1.81-1.56-2.18-2.04-2.1-2.74.08-.59-.4-1.12-1.4-1.42-1.14-.36-1.3-.56-1.5-1.8-.17-1.06-.28-1.3-.8-1.65-.5-.34-.64-.56-.64-1.14 0-.56.12-.78.42-.9.73-.3.73-1.09 0-1.5-.25-.14-.42-.42-.42-.61 0-.22-.28-.67-.7-1.06-.9-.87-1.8-1.34-2.9-1.45-.36-.03-.86 0-1.12.08z"/>
        </svg>
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
