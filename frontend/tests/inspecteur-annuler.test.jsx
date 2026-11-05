import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OverlayPanel from '../src/components/editor/OverlayPanel.jsx';
import { fusionnerInspecteur } from '../src/components/editor/fusionInspecteur.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

describe('« Annuler » dans le panneau d’habillage', () => {
  // L'INCIDENT : le bouton fermait le panneau sans rien défaire. Les
  // changements, appliqués en direct à l'aperçu, restaient dans le montage.
  it('remet les animations d’avant l’ouverture', () => {
    const initiales = [{ id: 'o1', templateId: 'titre_reportage', fields: {}, startTime: 0 }];
    const onChangePreview = vi.fn();
    const onClose = vi.fn();
    render(
      <I18nProvider>
        <OverlayPanel
          clip={{ instanceId: 'c1', name: 'rush.mp4', overlays: initiales }}
          onClose={onClose}
          onSave={() => {}}
          onChangePreview={onChangePreview}
          inline
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Supprimer —/ }));
    expect(onChangePreview).toHaveBeenLastCalledWith(expect.objectContaining({ overlays: [] }));

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onChangePreview).toHaveBeenLastCalledWith(expect.objectContaining({ overlays: initiales }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('l’inspecteur ne réécrit que ce qu’il modifie', () => {
  // L'INCIDENT : le panneau renvoyait sa copie entière du clip, prise à
  // l'ouverture. Un rognage fait entre-temps dans la timeline disparaissait à
  // la frappe suivante.
  it('garde un rognage fait après l’ouverture du panneau', () => {
    const montage = [{ instanceId: 'c1', durationSec: 4, trimStart: 2, overlays: [] }];
    const copieDuPanneau = { instanceId: 'c1', durationSec: 10, trimStart: 0, overlays: [{ id: 'o1' }] };
    const [clip] = fusionnerInspecteur(montage, copieDuPanneau, ['overlays']);
    expect(clip).toEqual({ instanceId: 'c1', durationSec: 4, trimStart: 2, overlays: [{ id: 'o1' }] });
  });

  it('ne touche pas aux autres clips', () => {
    const autre = { instanceId: 'c2', overlays: [] };
    const resultat = fusionnerInspecteur([{ instanceId: 'c1', overlays: [] }, autre], { instanceId: 'c1', overlays: [{ id: 'x' }] }, ['overlays']);
    expect(resultat[1]).toBe(autre);
  });
});
