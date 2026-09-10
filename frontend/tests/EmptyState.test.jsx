import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from '../src/components/EmptyState.jsx';
import EmptyInbox from '../src/components/illustrations/EmptyInbox.jsx';
import WaitingBroadcast from '../src/components/illustrations/WaitingBroadcast.jsx';

describe('EmptyState', () => {
  it('affiche le titre et la consigne', () => {
    render(<EmptyState title="Aucun fichier" hint="Touchez le bouton ci-dessus." />);
    expect(screen.getByText('Aucun fichier')).toBeInTheDocument();
    expect(screen.getByText('Touchez le bouton ci-dessus.')).toBeInTheDocument();
  });

  it('se contente d\'un titre', () => {
    const { container } = render(<EmptyState title="Rien ici" />);
    expect(screen.getByText('Rien ici')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('accepte une action', () => {
    render(<EmptyState title="Rien ici" action={<button type="button">Envoyer</button>} />);
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeInTheDocument();
  });
});

describe('illustrations', () => {
  it('sont décoratives : le texte porte le sens, pas le dessin', () => {
    for (const Illustration of [EmptyInbox, WaitingBroadcast]) {
      const { container, unmount } = render(<Illustration />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('focusable')).toBe('false');
      unmount();
    }
  });

  it('suivent la palette de la charte, sans couleur codée en dur', () => {
    // Aucune valeur hexadécimale : les couleurs viennent des variables de
    // thème, donc l'illustration s'adapte à la surface qui l'accueille.
    for (const Illustration of [EmptyInbox, WaitingBroadcast]) {
      const { container, unmount } = render(<Illustration />);
      expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(container.innerHTML).toMatch(/var\(--accent\)/);
      unmount();
    }
  });

  it('se redimensionnent en gardant leurs proportions', () => {
    const { container } = render(<EmptyInbox size={264} />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('width')).toBe('264');
    expect(svg.getAttribute('height')).toBe('216');
  });
});
