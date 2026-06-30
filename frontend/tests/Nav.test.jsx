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
    // Text appears twice (desktop + mobile nav), so use getAllByText
    expect(screen.getAllByText('Espace Reportages').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Espace Montage').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('JT Prêt').length).toBeGreaterThanOrEqual(1);
  });

  it('switches to delivery view on JT Prêt click', () => {
    const setView = vi.fn();
    renderWith({ currentView: 'home', setCurrentView: setView });
    // Click the first JT Prêt button (desktop nav)
    fireEvent.click(screen.getAllByText('JT Prêt')[0]);
    expect(setView).toHaveBeenCalledWith('delivery');
  });

  it('marks the active view with aria-current=page', () => {
    renderWith({ currentView: 'dashboard' });
    const dashboardBtns = screen.getAllByText('Espace Montage');
    expect(dashboardBtns[0].closest('button')).toHaveAttribute('aria-current', 'page');
  });

  it('switches view on click', () => {
    const setView = vi.fn();
    renderWith({ currentView: 'home', setCurrentView: setView });
    // Click the first Espace Montage button (desktop nav)
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
    // Text appears twice (desktop + mobile nav), so use getAllByText
    expect(screen.getAllByText('Reports Space').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Editing Room').length).toBeGreaterThanOrEqual(1);
  });
});
