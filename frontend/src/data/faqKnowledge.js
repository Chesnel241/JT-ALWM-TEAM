/**
 * Base de connaissances pour l'assistant IA (FAQ Dynamique)
 * Ce système analyse les mots-clés de l'utilisateur pour trouver la meilleure réponse.
 */

export const suggestedQuestions = [
  "Comment uploader un fichier ?",
  "Quelle est l'heure limite d'envoi ?",
  "Comment ajouter un pays ?",
  "Où voir le JT finalisé ?",
  "Comment ajouter un script texte ?"
];

export const faqKnowledge = [
  {
    keywords: ['bonjour', 'salut', 'coucou', 'hello', 'hey'],
    answer: "Bonjour ! Je suis l'assistant IA de la plateforme JT ALWM. Je suis là pour vous guider. Que puis-je faire pour vous ?"
  },
  {
    keywords: ['comment', 'uploader', 'envoyer', 'déposer', 'ajouter', 'fichier', 'vidéo', 'rush', 'script'],
    answer: "Pour envoyer vos fichiers (vidéos, audios, scripts) :\n1. Sur la page d'accueil, cliquez sur le bouton de votre pays.\n2. Vous arriverez dans votre Espace Reportages.\n3. Glissez et déposez simplement vos fichiers dans la grande zone prévue à cet effet.\n4. Assurez-vous d'avoir sélectionné la bonne semaine (en haut à gauche) !"
  },
  {
    keywords: ['pays', 'trouve pas', 'ajouter pays', 'mon pays', 'nouveau pays'],
    answer: "Si votre pays n'apparaît pas sur la page d'accueil, vous pouvez l'ajouter manuellement en cliquant sur le gros bouton '+' (Ajouter un pays). Entrez son nom et son code (ex: SN pour Sénégal)."
  },
  {
    keywords: ['heure', 'limite', 'deadline', 'clôture', 'fin', 'tard', 'dimanche'],
    answer: "La date limite stricte pour envoyer vos reportages est le **Dimanche à 17h30**. Passé ce délai, l'upload est bloqué par sécurité pour que l'équipe de montage puisse finaliser le JT. Le compteur en bas à gauche de la page d'accueil vous indique le temps restant."
  },
  {
    keywords: ['montage', 'télécharger', 'récupérer', 'jt prêt', 'final', 'voir le jt', 'visionner'],
    answer: "Pour voir ou télécharger le JT finalisé, rendez-vous dans l'onglet **'JT Prêt'** en haut de la page. Les monteurs y déposent la version finale qui est accessible à tous."
  },
  {
    keywords: ['script', 'texte', 'voix off', 'notes', 'écrire'],
    answer: "Dans votre Espace Reportages, vous avez un champ texte 'Saisir un script rapidement'. Vous pouvez y coller directement votre texte de voix off ou vos notes pour le monteur, puis cliquer sur 'Ajouter le script'."
  },
  {
    keywords: ['supprimer', 'effacer', 'erreur', 'trompé', 'mauvais fichier'],
    answer: "Si vous vous êtes trompé de fichier, allez dans votre Espace Reportages (en cliquant sur votre pays). À côté du fichier uploadé, vous verrez une icône de corbeille rouge. Cliquez dessus pour le supprimer."
  },
  {
    keywords: ['conservation', 'rétention', 'suppression automatique', 'combien de temps', 'gardé'],
    answer: "Pour ne pas saturer les serveurs, les fichiers envoyés sont supprimés automatiquement 48h après la fin de la semaine de diffusion correspondante."
  },
  {
    keywords: ['mot de passe', 'bloqué', 'accès', 'password'],
    answer: "La plateforme est protégée par un mot de passe global. Si vous l'avez perdu ou si vous ne le connaissez pas, merci de contacter le support."
  },
  {
    keywords: ['notification', 'whatsapp', 'alerte', 'prévenu', 'avertir'],
    answer: "Lorsque vous envoyez un fichier, vous pouvez choisir de renseigner votre numéro de téléphone. Le système vous enverra automatiquement un message WhatsApp dès que le JT final (JT Prêt) sera publié !"
  },
  {
    keywords: ['merci', 'super', 'génial', 'top', 'parfait'],
    answer: "Avec grand plaisir ! N'hésitez pas si vous avez d'autres questions. Bon reportage ! 🎤"
  },
  {
    keywords: ['page', 'endroit', 'lieu', 'suis-je', 'ici', 'où on est', 'quelle page'],
    answer: "Pour savoir où vous êtes et à quoi sert cet écran, le plus simple est de cliquer sur 'Lancer la visite guidée de cette page' juste au-dessus du champ texte ! Je vous ferai faire le tour du propriétaire. 😉"
  }
];

const DEFAULT_ANSWER = "Je ne suis pas sûr de bien comprendre votre question. Si je ne peux pas vous aider, **vous pouvez contacter directement le support sur WhatsApp au +33778669907**.";

/**
 * Fonction très basique pour simuler une IA.
 * Vérifie si la phrase de l'utilisateur contient les mots clés.
 */
export function getAIResponse(userInput) {
  const normalizedInput = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Score par réponse (le nombre de mots clés correspondants)
  let bestMatch = null;
  let maxScore = 0;

  for (const knowledge of faqKnowledge) {
    let score = 0;
    for (const keyword of knowledge.keywords) {
      const normalizedKeyword = keyword.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalizedInput.includes(normalizedKeyword)) {
        score += 1;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestMatch = knowledge.answer;
    }
  }

  // Si on a un score, on retourne la meilleure réponse
  if (maxScore > 0) {
    return bestMatch;
  }

  return DEFAULT_ANSWER;
}
