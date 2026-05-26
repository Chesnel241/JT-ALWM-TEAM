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
      disableBeacon: true,
    },
    {
      target: '#tour-country-list',
      content: t.aiAssistant.tourHome.countryList,
      placement: 'auto',
      disableBeacon: true,
    },
    {
      target: '#tour-add-country',
      content: t.aiAssistant.tourHome.addCountry,
      placement: 'auto',
      disableBeacon: true,
    },
    {
      target: '#tour-nav-editing',
      content: t.aiAssistant.tourHome.navEditing,
      placement: 'auto',
      disableBeacon: true,
    },
    {
      target: '#tour-nav-delivery',
      content: t.aiAssistant.tourHome.navDelivery,
      placement: 'auto',
      disableBeacon: true,
    }
  ],
  uploader: [
    {
      target: 'body',
      content: t.aiAssistant.tourUploader.welcome,
      placement: 'center',
      disableBeacon: true,
      disableBeacon: true,
    },
    {
      target: '#tour-countdown',
      content: t.aiAssistant.tourUploader.countdown,
      placement: 'auto',
      disableBeacon: true,
    },
    {
      target: '#tour-week-selector',
      content: t.aiAssistant.tourUploader.weekSelector,
      placement: 'auto',
      disableBeacon: true,
    },
    {
      target: '#tour-dropzone',
      content: t.aiAssistant.tourUploader.dropzone,
      placement: 'auto',
      disableBeacon: true,
    },
    {
      target: '#tour-script-box',
      content: t.aiAssistant.tourUploader.scriptBox,
      placement: 'auto',
      disableBeacon: true,
    },
    {
      target: '#tour-upload-list',
      content: t.aiAssistant.tourUploader.uploadList,
      placement: 'auto',
      disableBeacon: true,
    }
  ],
  dashboard: [
    {
      target: 'body',
      content: t.aiAssistant.tourDashboard.welcome,
      placement: 'center',
      disableBeacon: true,
      disableBeacon: true,
    },
    {
      target: '#tour-dashboard-header',
      content: t.aiAssistant.tourDashboard.header,
      placement: 'auto',
      disableBeacon: true,
    },
    {
      target: '#tour-editing-grid',
      content: t.aiAssistant.tourDashboard.grid,
      placement: 'auto',
      disableBeacon: true,
    }
  ],
  delivery: [
    {
      target: 'body',
      content: t.aiAssistant.tourDelivery.welcome,
      placement: 'center',
      disableBeacon: true,
      disableBeacon: true,
    },
    {
      target: '#delivery-week',
      content: t.aiAssistant.tourDelivery.weekSelector,
      placement: 'auto',
      disableBeacon: true,
    },
    {
      target: '#tour-delivery-dropzone',
      content: t.aiAssistant.tourDelivery.dropzone,
      placement: 'auto',
      disableBeacon: true,
    },
    {
      target: '#tour-delivery-list',
      content: t.aiAssistant.tourDelivery.list,
      placement: 'auto',
      disableBeacon: true,
    },
    {
      target: '#tour-delivery-whatsapp',
      content: t.aiAssistant.tourDelivery.whatsapp,
      placement: 'auto',
      disableBeacon: true,
    }
  ],
  voixoff: [
    {
      target: 'body',
      content: t.aiAssistant.tourVoixOff.welcome,
      placement: 'center',
      disableBeacon: true,
      disableBeacon: true,
    },
    {
      target: '#tour-voixoff-country',
      content: t.aiAssistant.tourVoixOff.country,
      placement: 'auto',
      disableBeacon: true,
    },
    {
      target: '#tour-voixoff-studio',
      content: t.aiAssistant.tourVoixOff.studio,
      placement: 'auto',
      disableBeacon: true,
    }
  ]
});
