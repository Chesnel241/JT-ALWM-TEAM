import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminGate from '../src/components/AdminGate.jsx';
import { api } from '../src/api/index.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { readAdminPassword } from '../src/lib/adminSession.js';

function poser(props = {}) {
  return render(
    <I18nProvider>
      <AdminGate {...props} />
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
  vi.restoreAllMocks();
});

describe('AdminGate — la porte de l’espace montage', () => {
  it('propose un champ et un bouton, là où il n’y avait qu’un message', () => {
    // Le constat d'origine : « Déverrouillez l'espace montage » sans aucun
    // moyen de le faire depuis l'écran concerné.
    poser();
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('retient le mot de passe pour la session et rend la main', async () => {
    const onDeverrouille = vi.fn();
    vi.spyOn(api, 'checkAdminPassword').mockResolvedValue(true);

    poser({ onDeverrouille });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: 'montage2026' } });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(onDeverrouille).toHaveBeenCalledWith('montage2026'));
    // Les autres écrans réservés le relisent : sans ça, il faudrait le
    // retaper à chaque changement d'onglet.
    expect(readAdminPassword()).toBe('montage2026');
  });

  it('nettoie les caractères invisibles collés depuis un presse-papier', async () => {
    const onDeverrouille = vi.fn();
    const espion = vi.spyOn(api, 'checkAdminPassword').mockResolvedValue(true);

    poser({ onDeverrouille });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), {
      target: { value: ' montage2026​ ' },
    });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(espion).toHaveBeenCalledWith('montage2026'));
  });

  it('dit « mot de passe incorrect » quand le serveur refuse', async () => {
    vi.spyOn(api, 'checkAdminPassword').mockResolvedValue(false);
    const onDeverrouille = vi.fn();

    poser({ onDeverrouille });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: 'faux' } });
    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect/i);
    expect(onDeverrouille).not.toHaveBeenCalled();
    expect(readAdminPassword()).toBe('');
  });

  it('distingue une panne réseau d’un mot de passe faux', async () => {
    // Les deux ne se corrigent pas de la même façon : dire « incorrect »
    // quand le serveur est muet envoie la personne chercher un mot de passe
    // qu'elle avait déjà.
    vi.spyOn(api, 'checkAdminPassword').mockRejectedValue(new Error('Network error'));

    poser();
    fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: 'montage2026' } });
    fireEvent.click(screen.getByRole('button'));

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).toMatch(/réessayez/i);
    expect(alerte.textContent).not.toMatch(/incorrect/i);
  });

  it('n’interroge pas le serveur pour un champ vide', () => {
    const espion = vi.spyOn(api, 'checkAdminPassword').mockResolvedValue(true);
    poser();
    fireEvent.click(screen.getByRole('button'));
    expect(espion).not.toHaveBeenCalled();
  });

  it('accepte un titre propre à l’écran qui l’accueille', () => {
    poser({ titre: 'Programmation réservée', sous: 'Le planning des monteurs.' });
    expect(screen.getByText('Programmation réservée')).toBeInTheDocument();
    expect(screen.getByText('Le planning des monteurs.')).toBeInTheDocument();
  });
});
