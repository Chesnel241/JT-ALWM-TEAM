import { describe, it, expect } from 'vitest';
import { translations } from '../src/i18n/translations.js';
import { getAIResponse } from '../src/data/faqKnowledge.js';
import { getTourSteps } from '../src/data/tourSteps.js';
import { phraseProchaineCloture, echeanceLocale, phraseEcheance } from '../src/lib/echeance.js';

/**
 * Aucun texte ne fait plus faire la conversion de tête.
 *
 * LE BESOIN : « dimanche 10h30 (GMT+2) » était écrit en dur dans six textes
 * lus par les correspondants. Un journaliste en GMT-3 lisait 10h30 et
 * envoyait à 10h — cinq heures après la clôture. L'aide en anglais disait
 * même « Sunday at 5:30 PM », sept heures trop tard.
 *
 * Seule exception : le message de relance que la RÉDACTION envoie par
 * WhatsApp (`relance.message`). Elle ne connaît pas le fuseau du destinataire :
 * l'heure de la rédaction, dite avec son fuseau, y est la bonne.
 */

const HEURE_EN_DUR = /10h30|10:30|GMT\+2|5:30 PM/;

function aplatir(objet, prefixe = '', sortie = []) {
  for (const [cle, valeur] of Object.entries(objet)) {
    const chemin = prefixe ? `${prefixe}.${cle}` : cle;
    if (valeur && typeof valeur === 'object') aplatir(valeur, chemin, sortie);
    else sortie.push([chemin, typeof valeur === 'function' ? valeur.toString() : String(valeur)]);
  }
  return sortie;
}

describe('l’heure limite n’est plus écrite en dur', () => {
  it.each(['fr', 'en'])('dans le dictionnaire (%s), hors relance de la rédaction', (lang) => {
    const fautifs = aplatir(translations[lang])
      .filter(([chemin, texte]) => !chemin.startsWith('relance.') && HEURE_EN_DUR.test(texte))
      .map(([chemin]) => chemin);
    expect(fautifs).toEqual([]);
  });

  it.each(['fr', 'en'])('dans l’aide (%s), qui donne la prochaine clôture dans le fuseau de l’appareil', (lang) => {
    const t = translations[lang];
    const question = lang === 'en' ? 'what is the deadline' : 'quelle est l’heure limite';
    const reponse = getAIResponse(question, t, lang);
    expect(reponse).toContain(phraseProchaineCloture(t, lang));
    expect(reponse).not.toMatch(/5:30 PM/);
  });

  it('dans la visite guidée de l’espace d’envoi', () => {
    const t = translations.fr;
    const etape = getTourSteps(t, 'fr').uploader.find((e) => e.target === '#tour-countdown');
    expect(etape.content).toContain(phraseProchaineCloture(t, 'fr'));
  });
});

describe('phraseEcheance', () => {
  const t = translations.fr;
  it('dit « votre heure » et le fuseau', () => {
    const e = echeanceLocale('2026-11-01T08:30:00Z', { timeZone: 'America/Sao_Paulo' });
    expect(phraseEcheance(e, t.echeance)).toBe('dimanche 05h30, votre heure (GMT-3)');
  });

  it('dit « heure de la rédaction » quand c’est la même', () => {
    const e = echeanceLocale('2026-11-01T08:30:00Z', { timeZone: 'Africa/Johannesburg' });
    expect(phraseEcheance(e, t.echeance)).toBe('dimanche 10h30, heure de la rédaction');
  });
});
