/**
 * Étapes de la visite guidée (Product Tour) pour react-joyride.
 * Divisé par "pages" (home, uploader, etc.)
 */

export const tourSteps = {
  home: [
    {
      target: 'body',
      content: 'Bienvenue sur le JT ALWM ! Je suis votre guide. Je vais vous montrer comment utiliser la plateforme en quelques secondes.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#tour-country-list',
      content: 'C\'est ici que vous devez sélectionner votre pays pour accéder à votre Espace Reportages.',
      placement: 'top',
    },
    {
      target: '#tour-add-country',
      content: 'Si votre pays n\'est pas dans la liste, vous pouvez l\'ajouter facilement avec ce bouton.',
      placement: 'bottom',
    },
    {
      target: '#tour-nav-editing',
      content: 'L\'équipe de montage utilise cet onglet pour récupérer vos rushs et scripts. Vous n\'avez normalement pas besoin d\'y aller.',
      placement: 'bottom',
    },
    {
      target: '#tour-nav-delivery',
      content: 'C\'est ici que vous pourrez voir et télécharger le JT une fois qu\'il sera monté et prêt !',
      placement: 'bottom',
    }
  ],
  uploader: [
    {
      target: 'body',
      content: 'Vous êtes dans votre Espace Reportages. C\'est ici que vous envoyez vos fichiers à l\'équipe de montage.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#tour-countdown',
      content: 'Ici, vous voyez le temps qu\'il vous reste avant la clôture des envois pour cette semaine (Dimanche 17h30).',
      placement: 'right',
    },
    {
      target: '#tour-week-selector',
      content: 'Assurez-vous toujours que la bonne semaine de diffusion est sélectionnée ici. Par défaut, c\'est la semaine en cours.',
      placement: 'bottom',
    },
    {
      target: '#tour-dropzone',
      content: 'Glissez et déposez simplement vos vidéos, images ou audios dans ce gros cadre ! Vous pouvez envoyer plusieurs fichiers en même temps.',
      placement: 'top',
    },
    {
      target: '#tour-script-box',
      content: 'Vous n\'avez pas le temps de faire un fichier Word ? Tapez ou collez directement le texte de votre voix off ou vos instructions pour le monteur ici.',
      placement: 'top',
    },
    {
      target: '#tour-upload-list',
      content: 'Tous les fichiers que vous avez envoyés pour cette semaine apparaîtront ici. Vous pouvez les supprimer si vous avez fait une erreur.',
      placement: 'left',
    }
  ]
};
