import { useState } from 'react';
import { urlDrapeau } from '../lib/drapeaux.js';

/**
 * La pastille d'un pays : son drapeau, servi par l'application
 * (`public/flags/`, voir lib/drapeaux.js), ou ses initiales à défaut.
 *
 * `ring` : un liseré blanc et une ombre, pour les grandes cartes où le
 * drapeau sert de repère principal.
 */
export default function CountryAvatar({ country, className = 'w-10 h-10', ring = false }) {
  const [imgError, setImgError] = useState(false);

  if (!country || (!country.id && !country.code)) {
    return <div className={`${className} rounded-full bg-[var(--paper-2)]`} aria-hidden="true" />;
  }

  const contour = ring
    ? 'ring-4 ring-white shadow-lg'
    : 'border border-black/10 shadow-sm';

  const nom = String(country.name || '').toLowerCase().trim();
  if (country.id === 'afrique' || nom === 'afrique' || nom === 'bureau afrique') {
    return (
      <div className={`${className} rounded-full overflow-hidden shrink-0 ${contour} bg-[var(--paper)] flex items-center justify-center`}>
        <img src="/afrique.svg" alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  const src = country.id === 'tj' || country.id === 'mj' ? null : urlDrapeau(country);

  if (!src || imgError) {
    // Fond OPAQUE : en translucide, cette pastille posée sur le chutier
    // sélectionné (fond bleu profond) rendait le code pays illisible.
    return (
      <div className={`${className} rounded-full flex items-center justify-center font-semibold shrink-0 ${contour} bg-white text-[color:var(--accent-deep)]`}>
        <span className="text-sm">{country.code}</span>
      </div>
    );
  }

  return (
    <div className={`${className} rounded-full overflow-hidden shrink-0 ${contour} bg-[var(--paper)] flex items-center justify-center`}>
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
        decoding="async"
        onError={() => setImgError(true)}
      />
    </div>
  );
}
