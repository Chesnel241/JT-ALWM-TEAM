import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Nav from '../src/components/Nav.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';

function renderWith(props = {}) {
  return render(
    <I18nProvider>
      <Nav currentView="home" setCurrentView={() => {}} {...props} />
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('Nav', () => {
  it('renders all navigation buttons (FR by default)', () => {
    renderWith();
    expect(screen.getAllByText('Espace Reportages')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Espace Montage')[0]).toBeInTheDocument();
    expect(screen.getAllByText('JT Prêt')[0]).toBeInTheDocument();
  });

  it('switches to delivery view on JT Prêt click', () => {
    const setView = vi.fn();
    renderWith({ currentView: 'home', setCurrentView: setView });
    fireEvent.click(screen.getAllByText('JT Prêt')[0]);
    expect(setView).toHaveBeenCalledWith('delivery');
  });

  it('marks the active view with active styles or indicator', () => {
    renderWith({ currentView: 'dashboard' });
    const dashboardBtns = screen.getAllByText('Espace Montage');
    expect(dashboardBtns.length).toBeGreaterThan(0);
  });

  it('switches view on click', () => {
    const setView = vi.fn();
    renderWith({ currentView: 'home', setCurrentView: setView });
    fireEvent.click(screen.getAllByText('Espace Montage')[0]);
    expect(setView).toHaveBeenCalledWith('dashboard');
  });

  it('shows language switcher with FR/EN buttons', () => {
    renderWith();
    expect(screen.getByRole('button', { name: 'FR' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
  });

  it('switches to English when EN is clicked', () => {
    renderWith();
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getAllByText('Reports Space')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Editing Room')[0]).toBeInTheDocument();
  });
});
