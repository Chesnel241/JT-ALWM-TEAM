/**
 * Étapes de la visite guidée (Product Tour) pour react-joyride.
 * Divisé par "pages" (home, uploader, etc.)
 */

export const getTourSteps = (t) => ({
  home: [
    {
      target: 'body',
      content: t.aiAssistant.tourHome.welcome,
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#tour-country-list',
      content: t.aiAssistant.tourHome.countryList,
      placement: 'top',
    },
    {
      target: '#tour-add-country',
      content: t.aiAssistant.tourHome.addCountry,
      placement: 'bottom',
    },
    {
      target: '#tour-nav-editing',
      content: t.aiAssistant.tourHome.navEditing,
      placement: 'bottom',
    },
    {
      target: '#tour-nav-delivery',
      content: t.aiAssistant.tourHome.navDelivery,
      placement: 'bottom',
    }
  ],
  uploader: [
    {
      target: 'body',
      content: t.aiAssistant.tourUploader.welcome,
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#tour-countdown',
      content: t.aiAssistant.tourUploader.countdown,
      placement: 'right',
    },
    {
      target: '#tour-week-selector',
      content: t.aiAssistant.tourUploader.weekSelector,
      placement: 'bottom',
    },
    {
      target: '#tour-dropzone',
      content: t.aiAssistant.tourUploader.dropzone,
      placement: 'top',
    },
    {
      target: '#tour-script-box',
      content: t.aiAssistant.tourUploader.scriptBox,
      placement: 'top',
    },
    {
      target: '#tour-upload-list',
      content: t.aiAssistant.tourUploader.uploadList,
      placement: 'left',
    }
  ],
  dashboard: [
    {
      target: 'body',
      content: t.aiAssistant.tourDashboard.welcome,
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#tour-editing-sidebar',
      content: t.aiAssistant.tourDashboard.sidebar,
      placement: 'right',
    },
    {
      target: '#dashboard-week',
      content: t.aiAssistant.tourDashboard.weekSelector,
      placement: 'bottom',
    },
    {
      target: '#tour-editing-grid',
      content: t.aiAssistant.tourDashboard.grid,
      placement: 'left',
    }
  ],
  delivery: [
    {
      target: 'body',
      content: t.aiAssistant.tourDelivery.welcome,
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#delivery-week',
      content: t.aiAssistant.tourDelivery.weekSelector,
      placement: 'bottom',
    },
    {
      target: '#tour-delivery-dropzone',
      content: t.aiAssistant.tourDelivery.dropzone,
      placement: 'top',
    },
    {
      target: '#tour-delivery-list',
      content: t.aiAssistant.tourDelivery.list,
      placement: 'left',
    },
    {
      target: '#tour-delivery-whatsapp',
      content: t.aiAssistant.tourDelivery.whatsapp,
      placement: 'top',
    }
  ]
});
