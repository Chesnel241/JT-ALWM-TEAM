import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HomeView from '../src/components/HomeView.jsx';

const COUNTRIES = [
  { id: 'sn', name: 'Sénégal', code: 'SN' },
  { id: 'cm', name: 'Cameroun', code: 'CM' },
];

describe('HomeView', () => {
  it('renders one button per country', () => {
    render(<HomeView countries={COUNTRIES} onSelectCountry={() => {}} />);
    expect(screen.getByText('Sénégal')).toBeInTheDocument();
    expect(screen.getByText('Cameroun')).toBeInTheDocument();
  });

  it('shows the country count badge', () => {
    render(<HomeView countries={COUNTRIES} onSelectCountry={() => {}} />);
    expect(screen.getByText(/2 pays/)).toBeInTheDocument();
  });

  it('calls onSelectCountry when a country is clicked', () => {
    const onSelect = vi.fn();
    render(<HomeView countries={COUNTRIES} onSelectCountry={onSelect} />);
    fireEvent.click(screen.getByLabelText('Entrer dans Sénégal'));
    expect(onSelect).toHaveBeenCalledWith(COUNTRIES[0]);
  });
});
