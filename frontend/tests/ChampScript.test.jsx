import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import ChampScript, { compterMots } from '../src/components/ChampScript.jsx';

/**
 * Le texte de la voix off se tape, se compte et s'efface d'un geste.
 *
 * LE BESOIN : sur téléphone, le champ du script était écrit en 12 px ; sur
 * ordinateur, il n'avait ni compteur ni moyen de tout effacer. Un
 * correspondant qui collait le mauvais texte devait le sélectionner à la
 * main pour le supprimer.
 */

function Banc({ onValider = vi.fn(), initial = '', desactive = false }) {
  const [valeur, setValeur] = useState(initial);
  return <ChampScript valeur={valeur} onChange={setValeur} onValider={onValider} desactive={desactive} />;
}

function monter(props) {
  return render(<I18nProvider><Banc {...props} /></I18nProvider>);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('compterMots', () => {
  it('compte les mots séparés par des espaces, des retours à la ligne ou des tabulations', () => {
    expect(compterMots('')).toBe(0);
    expect(compterMots('   ')).toBe(0);
    expect(compterMots(undefined)).toBe(0);
    expect(compterMots('Bonjour')).toBe(1);
    expect(compterMots('  Bonjour   Douala\n\tce matin ')).toBe(4);
  });
});

describe('ChampScript', () => {
  it('le champ a un nom, et le compteur suit la frappe', () => {
    monter({});
    const champ = screen.getByRole('textbox', { name: /script/i });
    expect(screen.getByText('0 mot')).toBeInTheDocument();
    fireEvent.change(champ, { target: { value: 'Le marché de Mokolo rouvre' } });
    expect(screen.getByText('5 mots')).toBeInTheDocument();
  });

  it('un champ vide ne s’enregistre pas, et n’a pas de bouton pour effacer', () => {
    monter({});
    expect(screen.getByRole('button', { name: /Enregistrer le script/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Effacer le texte/ })).toBeNull();
  });

  it('le bouton Effacer vide le champ et y remet le curseur', () => {
    monter({ initial: 'Un texte collé par erreur' });
    fireEvent.click(screen.getByRole('button', { name: /Effacer le texte/ }));
    const champ = screen.getByRole('textbox', { name: /script/i });
    expect(champ).toHaveValue('');
    expect(champ).toHaveFocus();
    expect(screen.getByText('0 mot')).toBeInTheDocument();
  });

  it('le bouton vert enregistre le texte', () => {
    const onValider = vi.fn();
    monter({ onValider, initial: 'Voix off du reportage' });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le script/ }));
    expect(onValider).toHaveBeenCalledTimes(1);
  });

  it('semaine clôturée : on ne peut ni écrire, ni effacer, ni enregistrer', () => {
    monter({ initial: 'Texte', desactive: true });
    expect(screen.getByRole('textbox', { name: /script/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Effacer le texte/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Enregistrer le script/ })).toBeDisabled();
  });
});
