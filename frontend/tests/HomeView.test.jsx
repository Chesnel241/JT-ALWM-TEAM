import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HomeView from '../src/components/HomeView.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';

const COUNTRIES = [
  { id: 'sn', name: 'Sénégal', code: 'SN' },
  { id: 'cm', name: 'Cameroun', code: 'CM' },
];

function renderHome(props = {}) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <HomeView countries={COUNTRIES} onSelectCountry={() => {}} {...props} />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('HomeView', () => {
  it('renders one button per country', () => {
    renderHome();
    expect(screen.getAllByText('Sénégal')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Cameroun')[0]).toBeInTheDocument();
  });

  it('shows the country count badge', () => {
    renderHome();
    expect(screen.getAllByText(/2 pays/)[0]).toBeInTheDocument();
  });

  it('calls onSelectCountry when a country is clicked', () => {
    const onSelect = vi.fn();
    renderHome({ onSelectCountry: onSelect });
    fireEvent.click(screen.getAllByLabelText('Entrer dans Sénégal')[0]);
    expect(onSelect).toHaveBeenCalledWith(COUNTRIES[0]);
  });

  it('shows the "Ajouter un pays" button', () => {
    renderHome();
    expect(screen.getAllByLabelText('Ajouter un nouveau pays')[0]).toBeInTheDocument();
  });

  it('opens the dialog when "Ajouter un pays" is clicked', () => {
    renderHome();
    fireEvent.click(screen.getAllByLabelText('Ajouter un nouveau pays')[0]);
    expect(screen.getByRole('dialog', { name: /Ajouter un pays/i })).toBeInTheDocument();
  });
});

describe('HomeView — tuiles à drapeau', () => {
  // LE BESOIN : on reconnaît son pays à son drapeau avant de lire son nom.
  // Il y avait deux listes (téléphone, ordinateur) qui divergeaient : le
  // compteur de l'une était écrit en français en dur.
  it('montre le drapeau de chaque pays, servi par l’application', () => {
    const { container } = renderHome();
    const sources = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(sources).toEqual(expect.arrayContaining(['/flags/sn.svg', '/flags/cm.svg']));
  });

  it('propose le dernier pays ouvert en tête, pour y revenir en un geste', () => {
    localStorage.setItem('last_selected_country_id', 'cm');
    const onSelect = vi.fn();
    renderHome({ onSelectCountry: onSelect });
    expect(screen.getByText('Dernier accès')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ouvrir'));
    expect(onSelect).toHaveBeenCalledWith(COUNTRIES[1]);
  });

  it('compte les pays dans la langue choisie', () => {
    localStorage.setItem('jt-alwm-lang', 'en');
    renderHome();
    expect(screen.getByText('2 countries')).toBeInTheDocument();
  });

  it('une recherche sans résultat propose d’ajouter le pays, et s’efface d’un geste', () => {
    renderHome();
    const champ = screen.getByRole('searchbox');
    fireEvent.change(champ, { target: { value: 'Atlantide' } });
    expect(screen.getByText(/Aucun pays ne correspond à « Atlantide »/)).toBeInTheDocument();
    expect(screen.getByText('Ajouter ce pays')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Effacer la recherche' }));
    expect(champ).toHaveValue('');
    expect(screen.getByText('Sénégal')).toBeInTheDocument();
  });
});
