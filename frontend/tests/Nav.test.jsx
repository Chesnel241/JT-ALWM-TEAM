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
    expect(screen.getByText('Espace Reportages')).toBeInTheDocument();
    expect(screen.getByText('Espace Montage')).toBeInTheDocument();
    expect(screen.getByText('JT Prêt')).toBeInTheDocument();
  });

  it('switches to delivery view on JT Prêt click', () => {
    const setView = vi.fn();
    renderWith({ currentView: 'home', setCurrentView: setView });
    fireEvent.click(screen.getByText('JT Prêt'));
    expect(setView).toHaveBeenCalledWith('delivery');
  });

  it('marks the active view with aria-current=page', () => {
    renderWith({ currentView: 'dashboard' });
    const dashboardBtn = screen.getByText('Espace Montage').closest('button');
    expect(dashboardBtn).toHaveAttribute('aria-current', 'page');
  });

  it('switches view on click', () => {
    const setView = vi.fn();
    renderWith({ currentView: 'home', setCurrentView: setView });
    fireEvent.click(screen.getByText('Espace Montage'));
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
    expect(screen.getByText('Reports Space')).toBeInTheDocument();
    expect(screen.getByText('Editing Room')).toBeInTheDocument();
  });
});
