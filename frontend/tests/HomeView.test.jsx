import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HomeView from '../src/components/HomeView.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';

const COUNTRIES = [
  { id: 'sn', name: 'Sénégal', code: 'SN' },
  { id: 'cm', name: 'Cameroun', code: 'CM' },
];

function renderHome(props = {}) {
  return render(
    <ToastProvider>
      <HomeView countries={COUNTRIES} onSelectCountry={() => {}} {...props} />
    </ToastProvider>
  );
}

describe('HomeView', () => {
  it('renders one button per country', () => {
    renderHome();
    expect(screen.getByText('Sénégal')).toBeInTheDocument();
    expect(screen.getByText('Cameroun')).toBeInTheDocument();
  });

  it('shows the country count badge', () => {
    renderHome();
    expect(screen.getByText(/2 pays/)).toBeInTheDocument();
  });

  it('calls onSelectCountry when a country is clicked', () => {
    const onSelect = vi.fn();
    renderHome({ onSelectCountry: onSelect });
    fireEvent.click(screen.getByLabelText('Entrer dans Sénégal'));
    expect(onSelect).toHaveBeenCalledWith(COUNTRIES[0]);
  });

  it('shows the "Ajouter un pays" button', () => {
    renderHome();
    expect(screen.getByLabelText('Ajouter un nouveau pays')).toBeInTheDocument();
  });

  it('opens the dialog when "Ajouter un pays" is clicked', () => {
    renderHome();
    fireEvent.click(screen.getByLabelText('Ajouter un nouveau pays'));
    expect(screen.getByRole('dialog', { name: /Ajouter un pays/i })).toBeInTheDocument();
  });
});
