import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Nav from '../src/components/Nav.jsx';

describe('Nav', () => {
  it('renders both navigation buttons', () => {
    render(<Nav currentView="home" setCurrentView={() => {}} />);
    expect(screen.getByText('Espace Correspondants')).toBeInTheDocument();
    expect(screen.getByText('Espace Montage')).toBeInTheDocument();
  });

  it('marks the active view with aria-current=page', () => {
    render(<Nav currentView="dashboard" setCurrentView={() => {}} />);
    const dashboardBtn = screen.getByText('Espace Montage').closest('button');
    expect(dashboardBtn).toHaveAttribute('aria-current', 'page');
  });

  it('switches view on click', () => {
    const setView = vi.fn();
    render(<Nav currentView="home" setCurrentView={setView} />);
    fireEvent.click(screen.getByText('Espace Montage'));
    expect(setView).toHaveBeenCalledWith('dashboard');
  });
});
