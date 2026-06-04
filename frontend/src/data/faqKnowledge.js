/**
 * Base de connaissances pour l'assistant IA (FAQ Dynamique)
 * Ce système analyse les mots-clés de l'utilisateur pour trouver la meilleure réponse.
 */

export const getSuggestedQuestions = (t) => [
  t.aiAssistant.suggestedQuestions.q1,
  t.aiAssistant.suggestedQuestions.q2,
  t.aiAssistant.suggestedQuestions.q3,
  t.aiAssistant.suggestedQuestions.q4,
  t.aiAssistant.suggestedQuestions.q5
];

const faqKnowledge = {
  fr: [
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
      keywords: ['script', 'texte', 'notes', 'écrire'],
      answer: "Dans votre Espace Reportages, vous avez un champ texte 'Saisir un script rapidement'. Vous pouvez y coller directement votre texte de voix off ou vos notes pour le monteur, puis cliquer sur 'Ajouter le script'."
    },
    {
      keywords: ['studio', 'voix off', 'enregistrer', 'enregistrement', 'micro', 'microphone', 'parler', 'studio voix'],
      answer: "L'onglet **Studio Voix Off** vous permet d'enregistrer votre voix off directement dans le navigateur :\n1. Choisissez la semaine puis votre pays.\n2. Renseignez le titre du reportage (obligatoire).\n3. Préparez votre texte dans la zone de script si besoin.\n4. Cliquez sur le micro pour démarrer l'enregistrement — un visualiseur affiche votre voix en direct.\n5. Réécoutez, puis envoyez : une compression de studio professionnelle est appliquée automatiquement avant l'envoi aux monteurs."
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
      keywords: ['merci', 'super', 'génial', 'top', 'parfait', 'thanks'],
      answer: "Avec grand plaisir ! N'hésitez pas si vous avez d'autres questions. Bon reportage ! 🎤"
    },
    {
      keywords: ['page', 'endroit', 'lieu', 'suis-je', 'ici', 'où on est', 'quelle page'],
      answer: "Pour savoir où vous êtes et à quoi sert cet écran, le plus simple est de cliquer sur 'Lancer la visite guidée de cette page' juste au-dessus du champ texte ! Je vous ferai faire le tour du propriétaire. 😉"
    }
  ],
  en: [
    {
      keywords: ['bonjour', 'salut', 'coucou', 'hello', 'hey', 'hi'],
      answer: "Hello! I'm the AI assistant for the ALWM Newscast platform. I'm here to guide you. How can I help?"
    },
    {
      keywords: ['how', 'upload', 'send', 'drop', 'add', 'file', 'video', 'rush', 'script'],
      answer: "To send your files (videos, audios, scripts):\n1. On the home page, click on your country's button.\n2. You will enter your Reports Space.\n3. Simply drag and drop your files into the large dropzone area.\n4. Make sure you have the correct week selected (top left)!"
    },
    {
      keywords: ['country', 'cannot find', 'add country', 'my country', 'new country'],
      answer: "If your country is not listed on the home page, you can easily add it by clicking the big '+' button (Add a country). Enter its name and code (e.g. SN for Senegal)."
    },
    {
      keywords: ['time', 'limit', 'deadline', 'closing', 'end', 'late', 'sunday'],
      answer: "The strict deadline to send your reports is **Sunday at 5:30 PM**. After this time, uploads are blocked for security so the editing team can finalize the broadcast. The countdown timer shows you the remaining time."
    },
    {
      keywords: ['edit', 'download', 'retrieve', 'final cut', 'final', 'watch', 'view'],
      answer: "To view or download the final newscast, go to the **'Final Cut'** tab at the top of the page. The editors upload the final version there, accessible to everyone."
    },
    {
      keywords: ['script', 'text', 'notes', 'write'],
      answer: "In your Reports Space, there is a 'Quick script entry' text box. You can paste your voice-over text or notes for the editor directly there, then click 'Add script'."
    },
    {
      keywords: ['studio', 'voice over', 'voiceover', 'record', 'recording', 'mic', 'microphone', 'speak', 'voice studio'],
      answer: "The **Voice-Over Studio** tab lets you record your voice-over right in the browser:\n1. Pick the week, then your country.\n2. Enter the report title (required).\n3. Prepare your text in the script area if needed.\n4. Click the mic to start recording — a live visualizer shows your voice.\n5. Play it back, then send: professional studio compression is applied automatically before delivery to the editors."
    },
    {
      keywords: ['delete', 'erase', 'error', 'mistake', 'wrong file'],
      answer: "If you uploaded the wrong file, go to your Reports Space. Next to the uploaded file, you'll see a red trash can icon. Click it to delete the file."
    },
    {
      keywords: ['retention', 'auto delete', 'how long', 'kept'],
      answer: "To prevent server overload, uploaded files are automatically deleted 48h after the end of their broadcast week."
    },
    {
      keywords: ['password', 'blocked', 'access', 'pwd'],
      answer: "The platform is protected by a global password. If you lost it or don't know it, please contact support."
    },
    {
      keywords: ['notification', 'whatsapp', 'alert', 'warn', 'ping'],
      answer: "When uploading a file, you can optionally provide your phone number. The system will automatically send you a WhatsApp message as soon as the final newscast (Final Cut) is published!"
    },
    {
      keywords: ['merci', 'super', 'génial', 'top', 'parfait', 'thanks', 'thank you', 'awesome'],
      answer: "You're very welcome! Let me know if you have any other questions. Happy reporting! 🎤"
    },
    {
      keywords: ['page', 'place', 'where', 'am i', 'here'],
      answer: "To know where you are and what this screen is for, the easiest way is to click 'Start the visual guide for this page' just above the text input! I'll give you a full tour. 😉"
    }
  ]
};

/**
 * Fonction très basique pour simuler une IA.
 * Vérifie si la phrase de l'utilisateur contient les mots clés.
 */
export function getAIResponse(userInput, t, lang = 'fr') {
  const normalizedInput = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Score par réponse (le nombre de mots clés correspondants)
  let bestMatch = null;
  let maxScore = 0;

  const knowledgeBase = faqKnowledge[lang] || faqKnowledge['fr'];

  for (const knowledge of knowledgeBase) {
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

  return t.aiAssistant.defaultAnswer;
}
