import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import AdminUploadDialog from '../src/components/AdminUploadDialog.jsx';

/**
 * L'INCIDENT : la fenêtre « reportage assemblé » gardait le fichier choisi
 * pour le pays précédent. Rouverte sur un autre pays, elle l'affichait encore
 * et « Envoyer » le déposait chez le mauvais pays.
 */
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

function vue(props) {
  return (
    <I18nProvider>
      <AdminUploadDialog onClose={() => {}} onUpload={() => {}} isLoading={false} {...props} />
    </I18nProvider>
  );
}

describe('AdminUploadDialog', () => {
  it('rouverte pour un autre pays, ne garde pas le fichier du précédent', () => {
    const { rerender, container } = render(vue({ isOpen: true, countryName: 'Gabon' }));
    const fichier = new File(['x'], 'libreville.mp4', { type: 'video/mp4' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [fichier] } });
    expect(screen.getByText(/libreville\.mp4/)).toBeInTheDocument();

    rerender(vue({ isOpen: false, countryName: 'Gabon' }));
    rerender(vue({ isOpen: true, countryName: 'Cameroun' }));
    expect(screen.queryByText(/libreville\.mp4/)).not.toBeInTheDocument();
  });
});
