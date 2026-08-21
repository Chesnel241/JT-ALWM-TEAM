import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VoixOffView from '../src/components/VoixOffView.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { ToastProvider } from '../src/hooks/useToast.jsx';

const MOCK_COUNTRIES = [
  { id: 'ga', name: 'Gabon', code: 'GA' },
  { id: 'ci', name: 'Côte d\'Ivoire', code: 'CI' },
];

const MOCK_WEEKS = [
  { id: '2026-W34', status: 'active', startDate: '2026-08-18' }
];

function renderVoixOff(props = {}) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <VoixOffView
          countries={MOCK_COUNTRIES}
          weeks={MOCK_WEEKS}
          selectedWeek="2026-W34"
          setSelectedWeek={vi.fn()}
          {...props}
        />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('VoixOffView', () => {
  it('renders Studio Voix Off title and selectable countries', () => {
    renderVoixOff();
    expect(screen.getAllByText(/Studio Voix Off/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText('Gabon')[0]).toBeInTheDocument();
  });

  it('selects a country and displays preparation form inputs', () => {
    renderVoixOff();
    const gabonBtn = screen.getAllByText('Gabon')[0].closest('button');
    fireEvent.click(gabonBtn);
    expect(screen.getAllByPlaceholderText(/Élections présidentielles/i)[0]).toBeInTheDocument();
  });
});
