import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import ChampWhatsApp from '../src/components/ChampWhatsApp.jsx';

/**
 * Le numéro WhatsApp dit en direct s'il est bon.
 *
 * LE BESOIN : le bouton d'enregistrement restait grisé sans dire pourquoi ;
 * un correspondant qui avait oublié un chiffre ne savait pas quoi corriger.
 * Le champ a désormais un libellé visible, et dit en vert « au bon format »
 * ou en orange « il manque des chiffres ».
 */

function Banc({ onValider, initial = '' }) {
  const [valeur, setValeur] = useState(initial);
  return <ChampWhatsApp valeur={valeur} onChange={setValeur} onValider={onValider} paysDefaut="CM" />;
}

function monter(props) {
  return render(<I18nProvider><Banc {...props} /></I18nProvider>);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('ChampWhatsApp', () => {
  it('a un libellé visible, relié au champ', () => {
    monter({});
    expect(screen.getByLabelText(/Numéro de téléphone/)).toBeInTheDocument();
  });

  it('un numéro incomplet : message orange, bouton fermé', () => {
    monter({ initial: '+23769900' });
    expect(screen.getByText(/Il manque des chiffres/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Valider/ })).toBeDisabled();
  });

  it('un numéro au bon format : message vert, et le bouton l’enregistre', () => {
    const onValider = vi.fn();
    monter({ initial: '+237699000000', onValider });
    expect(screen.getByText('Le numéro est au bon format.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Valider/ }));
    expect(onValider).toHaveBeenCalledWith();
  });

  it('vide : explique à quoi sert le numéro, sans reproche', () => {
    monter({});
    expect(screen.getByText(/On vous écrit seulement si un fichier pose problème/)).toBeInTheDocument();
  });
});
