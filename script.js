const fs = require('fs');

const frontendPath = 'frontend/src/data/overlayTemplates.js';
const backendPath = 'backend/src/data/overlayTemplates.js';

const templatesToAdd = 
  {
    id: 'envato_rep_minimal',
    label: 'Titre Reportage - Minimal Line',
    emoji: '??',
    preview: 'Une fine ligne s\\'étire et révèle le texte.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Précision' }
    ]
  },
  {
    id: 'envato_rep_skew',
    label: 'Titre Reportage - Double Skew',
    emoji: '??',
    preview: 'Deux blocs obliques qui se croisent pour former le titre.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Précision' }
    ]
  },
  {
    id: 'envato_rep_swipe',
    label: 'Titre Reportage - Gradient Swipe',
    emoji: '??',
    preview: 'Un balayage lumineux avec un dégradé.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Précision' }
    ]
  },
  {
    id: 'envato_rep_glass',
    label: 'Titre Reportage - Glassmorphism',
    emoji: '??',
    preview: 'Un effet verre dépoli très élégant.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Précision' }
    ]
  },
  {
    id: 'envato_rep_massif',
    label: 'Titre Reportage - Bloc Massif',
    emoji: '?',
    preview: 'Un titre lourd et impactant avec Drop Shadow profond.',
    fields: [
      { key: 'titre', label: 'Titre principal', placeholder: 'Titre du reportage' },
      { key: 'sous_titre', label: 'Sous-titre', placeholder: 'Précision' }
    ]
  },
  {
    id: 'envato_lt_compact',
    label: 'Lower Third - Compact 1 Ligne',
    emoji: '???',
    preview: 'Prénom/nom très rapide, pour les micro-trottoirs.',
    fields: [
      { key: 'nom', label: 'Nom', placeholder: 'PRÉNOM NOM' }
    ]
  },
  {
    id: 'envato_lt_corporate',
    label: 'Lower Third - Duo Corporate',
    emoji: '??',
    preview: 'Affichage nom/fonction très carré.',
    fields: [
      { key: 'nom', label: 'Nom', placeholder: 'PRÉNOM NOM' },
      { key: 'fonction', label: 'Fonction', placeholder: 'FONCTION / QUALITÉ' }
    ]
  },
  {
    id: 'envato_lt_interview',
    label: 'Lower Third - Interview',
    emoji: '??',
    preview: 'Bandeau double pour afficher qui parle face à qui.',
    fields: [
      { key: 'leftName', label: 'Nom Gauche', placeholder: 'JOURNALISTE' },
      { key: 'rightName', label: 'Nom Droit', placeholder: 'INVITÉ' }
    ]
  },
  {
    id: 'envato_loc_pin',
    label: 'Location Pin (Lieu)',
    emoji: '??',
    preview: 'Petite animation de géolocalisation.',
    fields: [
      { key: 'location', label: 'Lieu', placeholder: 'Paris, France' }
    ]
  },
  {
    id: 'envato_quote',
    label: 'Quote Block (Citation)',
    emoji: '?',
    preview: 'Magnifique pavé avec des guillemets animés.',
    fields: [
      { key: 'quote', label: 'Citation', placeholder: 'Texte de la citation ici...' }
    ]
  }
;

function inject(file) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/  }\n];/, "  },\n" + templatesToAdd + "\n];");
  fs.writeFileSync(file, newContent);
}

inject(frontendPath);
inject(backendPath);

// Also update DEFAULT_ANCHOR in backendPath
let content = fs.readFileSync(backendPath, 'utf8');
let anchors = \
  envato_rep_minimal: { x: 0, y: 1000 },
  envato_rep_skew: { x: 0, y: 1000 },
  envato_rep_swipe: { x: 0, y: 1000 },
  envato_rep_glass: { x: 0, y: 1000 },
  envato_rep_massif: { x: 0, y: 1000 },
  envato_lt_compact: { x: 0, y: 950 },
  envato_lt_corporate: { x: 0, y: 950 },
  envato_lt_interview: { x: 0, y: 950 },
  envato_loc_pin: { x: 50, y: 50 },
  envato_quote: { x: 960, y: 540 },
\;
content = content.replace(/  envato_split_screen: { x: 960, y: 540 },/, "  envato_split_screen: { x: 960, y: 540 },\n" + anchors);
fs.writeFileSync(backendPath, content);
