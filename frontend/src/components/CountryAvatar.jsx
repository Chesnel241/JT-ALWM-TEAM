import React, { useState } from 'react';

export default function CountryAvatar({ country, className = "w-10 h-10" }) {
  const [imgError, setImgError] = useState(false);
  
  if (!country || !country.id || !country.code) {
    return <div className={`${className} rounded-full bg-gray-200`}></div>;
  }

  const isSpecial = country.id === 'tj' || country.id === 'mj' || country.id === 'afrique';
  
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
        src={`https://flagcdn.com/w40/${country.id.toLowerCase()}.png`}
        srcSet={`https://flagcdn.com/w80/${country.id.toLowerCase()}.png 2x`}
        alt={country.name}
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
      />
    </div>
  );
}
