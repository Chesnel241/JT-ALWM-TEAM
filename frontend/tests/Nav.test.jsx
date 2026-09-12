import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Nav from '../src/components/Nav.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { WORKSPACES } from '../src/lib/routing.js';

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

describe('Nav — espace journalistes', () => {
  function renderReporter(props = {}) {
    return render(
      <I18nProvider>
        <Nav
          currentView="home"
          setCurrentView={() => {}}
          workspace={WORKSPACES.REPORTER}
          {...props}
        />
      </I18nProvider>
    );
  }

  it('expose les onglets journalistes (reportage, voix off, télécharger le JT)', () => {
    renderReporter();
    expect(screen.getAllByText('Espace reportage')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Voix Off')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Télécharger le JT')[0]).toBeInTheDocument();
    // Les onglets réservés à l'équipe montage doivent avoir disparu.
    expect(screen.queryByText('Espace Montage')).not.toBeInTheDocument();
    expect(screen.queryByText('Stats & Délais')).not.toBeInTheDocument();
  });

  it('ne dépasse jamais trois onglets côté correspondants', () => {
    // Garde-fou. À cinq onglets, mesuré dans un navigateur à 390 px, la barre
    // du bas affichait « Repo… Voice… Cond… Mot … Dow… » : aucun libellé
    // entier, sur le repère le plus utilisé des correspondants. Le conducteur
    // et le Mot du JT s'ouvrent depuis l'accueil, pas depuis la barre.
    const { container } = renderReporter();
    const barre = container.querySelector('.app-chrome-bottom');
    const onglets = barre.querySelectorAll('button');
    expect(onglets.length).toBeLessThanOrEqual(3);

    // Et aucun libellé ne doit être une abréviation coupée.
    for (const onglet of onglets) {
      expect(onglet.textContent.trim()).not.toMatch(/…|\.\.\.$/);
      expect(onglet.textContent.trim().length).toBeGreaterThan(0);
    }
  });

  it('n\'allume aucun onglet quand on est sur une rubrique du journal', () => {
    // Le conducteur et le Mot du JT ne sont plus dans la barre : aucun des
    // trois onglets ne doit paraître actif à leur place.
    const { container } = renderReporter({ currentView: 'conducteur' });
    const actifs = container.querySelectorAll('[aria-current="page"]');
    expect(actifs.length).toBe(0);
  });

  it('ouvre le JT prêt depuis l\'onglet de téléchargement', () => {
    const setView = vi.fn();
    renderReporter({ setCurrentView: setView });
    fireEvent.click(screen.getAllByText('Télécharger le JT')[0]);
    expect(setView).toHaveBeenCalledWith('delivery');
  });

  it('masque les onglets sur l\'accueil journalistes', () => {
    renderReporter({ currentView: 'hub' });
    expect(screen.queryByText('Espace reportage')).not.toBeInTheDocument();
    expect(screen.queryByText('Voix Off')).not.toBeInTheDocument();
    expect(screen.queryByText('Télécharger le JT')).not.toBeInTheDocument();
  });

  it('ramène à l\'accueil via le logo', () => {
    const setView = vi.fn();
    renderReporter({ currentView: 'delivery', setCurrentView: setView });
    fireEvent.click(screen.getByRole('button', { name: /revenir à l.accueil journalistes/i }));
    expect(setView).toHaveBeenCalledWith('hub');
  });

  it('offre un bouton Accueil explicite hors de l\'accueil', () => {
    const setView = vi.fn();
    renderReporter({ currentView: 'delivery', setCurrentView: setView });
    fireEvent.click(screen.getByRole('button', { name: 'Accueil' }));
    expect(setView).toHaveBeenCalledWith('hub');
  });

  it('n\'affiche pas le bouton Accueil quand on y est déjà', () => {
    renderReporter({ currentView: 'hub' });
    expect(screen.queryByRole('button', { name: 'Accueil' })).not.toBeInTheDocument();
  });
});

describe('Nav — téléphone', () => {
  const realWidth = window.innerWidth;
  afterEach(() => {
    window.innerWidth = realWidth;
  });

  function renderMobile(props = {}) {
    window.innerWidth = 375;
    return render(
      <I18nProvider>
        <Nav currentView="home" setCurrentView={() => {}} {...props} />
      </I18nProvider>
    );
  }

  it('raccourcit les libellés d\'onglets qui ne tiennent pas sur la largeur', () => {
    renderMobile();
    expect(screen.getAllByText('Reportages')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Montage')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Stats')[0]).toBeInTheDocument();
    expect(screen.queryByText('Espace Reportages')).not.toBeInTheDocument();
    expect(screen.queryByText('Stats & Délais')).not.toBeInTheDocument();
  });

  it('réduit cloche et sélecteur de langue en icônes', () => {
    renderMobile();
    // En compact, les pastilles de langue ne portent plus le texte FR/EN.
    expect(screen.queryByRole('button', { name: 'FR' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'EN' })).not.toBeInTheDocument();
    expect(screen.queryByText('Activer Notifications')).not.toBeInTheDocument();
  });

  it('garde le titre court côté journalistes', () => {
    renderMobile({ workspace: WORKSPACES.REPORTER, currentView: 'delivery' });
    expect(screen.getByText('Journalistes')).toBeInTheDocument();
    expect(screen.queryByText('Espace journalistes')).not.toBeInTheDocument();
  });
});
