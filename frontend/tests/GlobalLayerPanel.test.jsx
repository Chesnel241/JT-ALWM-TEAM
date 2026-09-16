import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GlobalLayerPanel from '../src/components/editor/GlobalLayerPanel.jsx';
import { OverlayEditor } from '../src/components/editor/OverlayPanel.jsx';
import { DEFAULT_BRANDING } from '../src/components/editor/timelineWorkspace.js';
import { COULEURS } from '../../remotion/src/identite.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';

/**
 * L'habillage global du JT.
 *
 * Ce panneau n'avait aucun test. Une modification y a cassé l'export nommé
 * d'`OverlayEditor` : la suite est restée verte, et c'est `npm run build` qui
 * a signalé la panne — après coup, et seulement parce qu'on l'a lancé. Un
 * montage simple aurait suffi.
 */

vi.mock('../src/api/index.js', () => ({
  api: {
    getThemes: vi.fn().mockResolvedValue([]),
    saveTheme: vi.fn().mockResolvedValue({}),
    deleteTheme: vi.fn().mockResolvedValue({}),
  },
  API_BASE: 'http://localhost:3010',
}));

function poser(surcharge = {}) {
  const onChange = vi.fn();
  const utils = render(
    <I18nProvider>
    <GlobalLayerPanel
      value={{ ...DEFAULT_BRANDING, ...(surcharge.value || {}) }}
      onChange={onChange}
      onClose={() => {}}
      inline
      adminPassword="mot-de-passe"
      {...surcharge}
    />
    </I18nProvider>
  );
  return { ...utils, onChange };
}

beforeEach(() => {
  localStorage.clear();
  // jsdom annonce `navigator.language = 'en-US'` : sans ce choix explicite,
  // le panneau monterait en anglais. Même convention que Nav.test.jsx.
  localStorage.setItem('jt-alwm-lang', 'fr');
  vi.clearAllMocks();
});

describe('le panneau d’habillage global', () => {
  it('se monte sans erreur', () => {
    // Le test qui manquait : il attrape un import cassé avant le build.
    expect(() => poser()).not.toThrow();
  });

  it('expose ses sections au monteur', () => {
    poser();
    expect(screen.getByText(/Habillage JT/i)).toBeInTheDocument();
    expect(screen.getByText(/Bande défilante/i)).toBeInTheDocument();
    expect(screen.getByText(/Badge LIVE/i)).toBeInTheDocument();
  });

  it('n’affiche plus le réglage d’interligne, que rien ne lisait', () => {
    // Trois curseurs l'écrivaient, le serveur le validait, aucun moteur de
    // rendu ne l'appliquait.
    poser();
    expect(screen.queryByText(/Interligne/i)).not.toBeInTheDocument();
  });

  it('remonte une modification du ticker sans écraser le reste', () => {
    const { onChange } = poser();
    const cases = screen.getAllByRole('checkbox');
    fireEvent.click(cases[0]);
    expect(onChange).toHaveBeenCalled();
    const envoye = onChange.mock.calls[0][0];
    // Le reste de l'habillage doit survivre à une case cochée.
    expect(envoye).toHaveProperty('atmosphere');
    expect(envoye).toHaveProperty('logoPosition');
  });
});

describe('les couleurs proposées au monteur', () => {
  it('viennent de la charte, et non de valeurs inventées', () => {
    // Cinq thèmes vivaient ici, dont un « ALWM Signature » or sur ardoise
    // sans rapport avec la marque. Le studio, le rendu Remotion et le repli
    // libass lisent maintenant le même fichier.
    const onChange = vi.fn();
    render(
      <I18nProvider>
        <OverlayEditor
          overlay={{ id: 'o1', templateId: 'titre_reportage', fields: {} }}
          onChange={onChange}
          onRemove={() => {}}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /JT ALWM/i }));
    expect(onChange).toHaveBeenCalled();
    const { colors } = onChange.mock.calls[0][0];
    expect(colors.bg).toBe(COULEURS.structure);
    expect(colors.text).toBe(COULEURS.papier);
    expect(colors.accent).toBe(COULEURS.accent);
  });

  it('ne nomme plus une palette par un emoji seul', () => {
    // « 🔴 Urgent » n'a pas de nom accessible une fois l'emoji retiré.
    render(
      <I18nProvider>
        <OverlayEditor
          overlay={{ id: 'o1', templateId: 'titre_reportage', fields: {} }}
          onChange={() => {}}
          onRemove={() => {}}
        />
      </I18nProvider>
    );
    ['JT ALWM', 'Alerte', 'Sobre'].forEach((nom) => {
      expect(screen.getByRole('button', { name: new RegExp(nom, 'i') })).toBeInTheDocument();
    });
  });
});
