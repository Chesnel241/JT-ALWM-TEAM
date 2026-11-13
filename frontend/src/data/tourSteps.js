/**
 * Les visites guidées (react-joyride), écran par écran.
 *
 * L'aide flottante ne s'affiche que dans l'espace montage, hors du studio
 * (voir App.jsx) : les visites couvrent donc ses écrans — la revue des rushes
 * sur tablette, JT Prêt, la voix off, le planning, les statistiques. Côté
 * journalistes, c'est le guide en images (GuideView) qui fait ce travail.
 *
 * L'INCIDENT : la visite pointait trois éléments qui n'existaient plus
 * (`#tour-nav-editing`, `#tour-delivery-dropzone`, `#tour-voixoff-country`)
 * et décrivait des écrans d'avant les refontes. Chaque cible est maintenant
 * vérifiée par un test (tests/guide.test.jsx) : un identifiant retiré du code
 * fait échouer la suite au lieu de laisser une visite muette.
 */

const etape = (target, content, placement = 'auto') => ({ target, content, placement, disableBeacon: true });

export const getTourSteps = (t) => {
  const v = t.aiAssistant;
  return {
    dashboard: [
      etape('body', v.tourDashboard.welcome, 'center'),
      etape('#tour-dashboard-header', v.tourDashboard.header),
      etape('#tour-editing-sidebar', v.tourDashboard.sidebar),
      etape('#tour-editing-grid', v.tourDashboard.grid),
    ],
    delivery: [
      etape('body', v.tourDelivery.welcome, 'center'),
      etape('#delivery-week', v.tourDelivery.weekSelector),
      etape('#tour-delivery-list', v.tourDelivery.list),
      etape('#tour-delivery-whatsapp', v.tourDelivery.whatsapp),
    ],
    voixoff: [
      etape('body', v.tourVoixOff.welcome, 'center'),
      etape('#tour-voixoff-semaine', v.tourVoixOff.semaine),
      etape('#tour-voixoff-studio', v.tourVoixOff.studio),
    ],
    planning: [
      etape('body', v.tourPlanning.welcome, 'center'),
      etape('#tour-planning-titre', v.tourPlanning.titre),
    ],
    stats: [
      etape('body', v.tourStats.welcome, 'center'),
      etape('#tour-stats-indicateurs', v.tourStats.indicateurs),
      etape('#stats-participation', v.tourStats.participation),
      etape('#stats-pays', v.tourStats.pays),
      etape('#stats-delais', v.tourStats.delais),
    ],
  };
};
