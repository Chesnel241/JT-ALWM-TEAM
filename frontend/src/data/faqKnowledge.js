import { phraseProchaineCloture } from '../lib/echeance.js';

/**
 * Les réponses de l'aide, par mots-clés.
 *
 * Ce n'est pas une intelligence artificielle : la phrase est comparée à des
 * mots-clés (sans accents), et la réponse qui en partage le plus gagne.
 */

export const getSuggestedQuestions = (t) => [
  t.aiAssistant.suggestedQuestions.q1,
  t.aiAssistant.suggestedQuestions.q2,
  t.aiAssistant.suggestedQuestions.q3,
  t.aiAssistant.suggestedQuestions.q4,
  t.aiAssistant.suggestedQuestions.q5
];

const faqKnowledge = {
  // L'aide ne s'affiche que dans l'espace montage (voir App.jsx) : elle répond
  // aux questions d'un monteur. Les correspondants ont le guide en images.
  fr: [
    {
      keywords: ['bonjour', 'salut', 'coucou', 'hello', 'hey'],
      answer: "Bonjour ! Posez votre question sur la plateforme : la revue des rushes, le JT en un clic, la publication, les délais, les statistiques… Le guide en images est aussi accessible ici."
    },
    {
      keywords: ['un clic', 'monter le jt', 'gabarit', 'charpente', 'automatique', 'deroule', 'construire'],
      answer: "Dans le studio, colonne « Rushes de la semaine », **« Monter le JT en un clic »** pose tout le journal dans l'ordre des jingles : générique, carton « Les titres » écrit à partir des sujets, chaque reportage avec son titre, la virgule entre deux, les annonces et séminaires par pays avec leur bandeau et leurs voix off, le mot du JT, puis la fin. Le déroulé actuel est remplacé après confirmation, et le geste reste annulable (bouton « Annuler »)."
    },
    {
      keywords: ['controle', 'generer', 'rendu', 'master', 'exporter', 'verifier'],
      answer: "« Générer le JT » passe d'abord par un **contrôle** : rush refusé ou introuvable, plan de moins d'une seconde, habillage sans texte, titres l'un sur l'autre, durée visée dépassée, générique absent. Rien n'est bloquant : « Voir » mène au plan, « Générer quand même » lance le rendu. Le son du master est mis à la norme de diffusion (EBU R 128)."
    },
    {
      keywords: ['publier', 'publication', 'jt pret', 'livraison', 'diffuser', 'envoyer le jt'],
      answer: "Une fois le master rendu, **« Publier dans JT Prêt »** sur sa bannière le publie sans le re-télécharger, avec son sommaire. Les correspondants sont prévenus ; ceux dont un reportage passe reçoivent la minute exacte. Vous pouvez aussi déposer un fichier dans l'onglet « Livraison »."
    },
    {
      keywords: ['telephone', 'version legere', 'leger', 'donnees mobiles', '480', 'poids du jt'],
      answer: "À chaque publication, le serveur prépare une **version téléphone** (480p, quatre à six fois plus légère) pour les correspondants en données mobiles. Elle apparaît en quelques minutes ; le master reste proposé en qualité TV. Si le master est déjà léger, aucune copie n'est faite."
    },
    {
      keywords: ['sommaire', 'chapitre', 'youtube', 'facebook', 'minute'],
      answer: "Le **sommaire** est calculé depuis le déroulé au lancement du rendu (jingles de rubrique, « Les titres », titre de chaque reportage). Dans « Livraison », **« Copier pour YouTube / Facebook »** donne le texte à coller dans la description : il devient des chapitres (0:00 en tête, parties de 10 s au moins)."
    },
    {
      keywords: ['valider', 'refuser', 'rush', 'revue', 'motif', 'a revoir'],
      answer: "Dans un chutier, **« Valider »** se fait en un geste ; **« Refuser »** ouvre la fenêtre du motif, envoyé au correspondant sur WhatsApp. Dans la visionneuse, les flèches passent au fichier suivant. « Tout valider » valide un reportage entier, annulable 8 s."
    },
    {
      keywords: ['delai', 'prolonger', 'retard', 'extension', 'plus de temps'],
      answer: "Dans « Stats & Délais », section **« Délais de la semaine »** : accordez +1 h, +3 h ou +12 h à un pays qui l'a demandé, ou à tous. L'heure obtenue est écrite sur le bouton ; un délai ne raccourcit jamais celui déjà accordé."
    },
    {
      keywords: ['heure', 'limite', 'deadline', 'cloture', 'dimanche'],
      // L'heure dite dans le fuseau de l'appareil : « dimanche 10h30 (GMT+2) »
      // obligeait chaque lecteur à faire la conversion de tête.
      answer: ({ echeance }) => `La clôture des envois est **${echeance}**. Après, l'espace d'envoi des correspondants se ferme, sauf délai accordé depuis « Stats & Délais » ; un fichier arrivé après la clôture est marqué « en retard ».`
    },
    {
      keywords: ['statistique', 'stats', 'csv', 'tableur', 'participation', 'vues'],
      answer: "**« Stats & Délais »** montre les douze dernières semaines : participation, envois à l'heure, délais, refus, poids reçu, publication et durée du JT, vues du JT par pays (anonymes). Touchez un pays pour sa fiche ; **« Exporter (CSV) »** ouvre le tout dans un tableur."
    },
    {
      keywords: ['suivi', 'correspondant', 'retenu', 'diffuse', 'vu par'],
      answer: "Chaque correspondant voit le **suivi** de son reportage : reçu, vu par la rédaction (dès qu'un fichier est ouvert, validé ou refusé), retenu (posé au déroulé), diffusé (avec la minute). Rien à faire de plus de votre côté."
    },
    {
      keywords: ['voix off', 'enregistrer', 'micro', 'studio voix'],
      answer: "L'onglet **Voix Off** permet d'enregistrer une voix dans le navigateur, ou de retrouver celles envoyées par les correspondants. Sur la timeline, la piste A1 « Son » reçoit voix off et musiques par glisser-déposer ; la musique baisse sous la voix."
    },
    {
      keywords: ['supprimer', 'effacer', 'retirer'],
      answer: "Un rush se supprime depuis sa carte (corbeille), un JT publié depuis « Livraison ». Supprimer un JT retire aussi sa version téléphone."
    },
    {
      keywords: ['conservation', 'retention', 'combien de temps', 'garde'],
      answer: "Les fichiers sont supprimés automatiquement 48 h après la fin de la semaine de diffusion. Le bilan de chaque semaine (des nombres seulement) est conservé pour les statistiques."
    },
    {
      keywords: ['mot de passe', 'bloque', 'acces', 'password'],
      answer: "L'espace montage demande le mot de passe de l'équipe. Il ne s'écrit jamais dans une adresse ; s'il est perdu, demandez-le à la personne qui gère le serveur."
    },
    {
      keywords: ['merci', 'super', 'genial', 'parfait', 'thanks'],
      answer: "Avec plaisir. Bon montage !"
    },
    {
      keywords: ['page', 'ou suis', 'ici', 'quelle page', 'guide', 'aide'],
      answer: "Pour savoir à quoi sert cet écran, lancez **« Visite de cette page »** ; pour tout l'espace, ouvrez **« Le guide en images »**."
    }
  ],
  en: [
    {
      keywords: ['hello', 'hi', 'hey', 'bonjour'],
      answer: "Hello! Ask your question about the platform: reviewing footage, the one-click newscast, publishing, extensions, statistics… The picture guide is available here too."
    },
    {
      keywords: ['one click', 'build the newscast', 'template', 'automatic', 'rundown', 'build'],
      answer: "In the studio, “This week’s footage” column, **“Build the newscast in one click”** lays out the whole newscast in jingle order: opening titles, a “Headlines” card written from the stories, each report with its title, the bumper between two, announcements and seminars by country with their lower third and voice-overs, the Word of the newscast, then the ending. The current rundown is replaced after confirmation, and the change can be undone (“Undo” button)."
    },
    {
      keywords: ['check', 'render', 'generate', 'master', 'export', 'verify'],
      answer: "“Generate” first runs a **check**: rejected or missing footage, shots under one second, graphics without text, overlapping titles, target length exceeded, missing opening titles. Nothing blocks: “View” leads to the shot, “Generate anyway” starts the render. The master’s sound is brought to the broadcast standard (EBU R 128)."
    },
    {
      keywords: ['publish', 'publication', 'final cut', 'delivery', 'air'],
      answer: "Once the master is rendered, **“Publish to Final Cut”** on its banner publishes it without downloading it again, with its contents. Correspondents are notified; those whose report airs get the exact minute. You can also drop a file in the “Delivery” tab."
    },
    {
      keywords: ['phone', 'light version', 'lighter', 'mobile data', '480'],
      answer: "Each time a newscast is published, the server prepares a **phone version** (480p, four to six times lighter) for correspondents on mobile data. It appears within minutes; the master stays available in TV quality. If the master is already light, no copy is made."
    },
    {
      keywords: ['contents', 'chapter', 'youtube', 'facebook', 'minute'],
      answer: "The **contents** are computed from the rundown when the render starts (section jingles, “Headlines”, each report’s title). In “Delivery”, **“Copy for YouTube / Facebook”** gives the text to paste into the description: it becomes chapters (0:00 first, parts of at least 10 s)."
    },
    {
      keywords: ['approve', 'reject', 'footage', 'review', 'reason'],
      answer: "In a bin, **“Approve”** takes one gesture; **“Reject”** opens the reason window, sent to the correspondent on WhatsApp. In the viewer, the arrows move to the next file. “Approve all” approves a whole report, undoable for 8 s."
    },
    {
      keywords: ['extension', 'extend', 'late', 'more time'],
      answer: "In “Stats & Delays”, section **“This week’s extensions”**: grant +1 h, +3 h or +12 h to a country that asked, or to all. The resulting time is written on the button; an extension never shortens one already granted."
    },
    {
      keywords: ['time', 'limit', 'deadline', 'closing', 'sunday'],
      // Annonçait « Sunday at 5:30 PM » : sept heures après la vraie clôture.
      answer: ({ echeance }) => `The sending deadline is **${echeance}**. After it, the correspondents’ sending space closes unless an extension is granted from “Stats & Delays”; a file that arrives after the deadline is marked “late”.`
    },
    {
      keywords: ['statistics', 'stats', 'csv', 'spreadsheet', 'participation', 'views'],
      answer: "**“Stats & Delays”** shows the last twelve weeks: participation, on-time sending, extensions, rejections, data received, newscast publication and length, newscast views by country (anonymous). Tap a country for its sheet; **“Export (CSV)”** opens it all in a spreadsheet."
    },
    {
      keywords: ['tracking', 'correspondent', 'selected', 'aired', 'seen by'],
      answer: "Each correspondent sees the **tracking** of their report: received, seen by the newsroom (as soon as a file is opened, approved or rejected), selected (placed in the rundown), aired (with the minute). Nothing more to do on your side."
    },
    {
      keywords: ['voice over', 'voiceover', 'record', 'mic', 'voice studio'],
      answer: "The **Voice Over** tab lets you record a voice in the browser, or find those sent by correspondents. On the timeline, the A1 “Sound” track takes voice-overs and music by drag and drop; music ducks under the voice."
    },
    {
      keywords: ['delete', 'erase', 'remove'],
      answer: "Footage is deleted from its card (bin icon), a published newscast from “Delivery”. Deleting a newscast also removes its phone version."
    },
    {
      keywords: ['retention', 'auto delete', 'how long', 'kept'],
      answer: "Files are deleted automatically 48 h after the end of the broadcast week. Each week’s summary (numbers only) is kept for the statistics."
    },
    {
      keywords: ['password', 'blocked', 'access'],
      answer: "The editing space asks for the team password. It is never written in an address; if it is lost, ask the person who runs the server."
    },
    {
      keywords: ['thanks', 'thank you', 'great', 'perfect', 'merci'],
      answer: "You’re welcome. Happy editing!"
    },
    {
      keywords: ['page', 'where am i', 'here', 'which page', 'guide', 'help'],
      answer: "To learn what this screen is for, start **“Tour of this page”**; for the whole space, open **“The picture guide”**."
    }
  ]
};

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

  // Si on a un score, on retourne la meilleure réponse. Une réponse peut
  // dépendre du moment et du fuseau (l'heure limite) : elle est alors une
  // fonction, appelée ici.
  if (maxScore > 0) {
    return typeof bestMatch === 'function'
      ? bestMatch({ echeance: phraseProchaineCloture(t, lang) })
      : bestMatch;
  }

  return t.aiAssistant.defaultAnswer;
}
