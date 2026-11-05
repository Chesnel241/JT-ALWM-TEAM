import { describe, it, expect } from 'vitest';
import { messageErreur } from '../src/lib/erreursReseau.js';
import { translations } from '../src/i18n/translations.js';

// L'INCIDENT : « tus: failed to upload chunk at offset 0, caused by
// [object ProgressEvent]… » s'affichait tel quel à un correspondant.
describe('le message d’un envoi qui échoue', () => {
  const fr = translations.fr.errors;
  const en = translations.en.errors;

  it('dit quoi faire, cas par cas', () => {
    expect(messageErreur(0, fr)).toMatch(/connexion/i);
    expect(messageErreur(423, fr)).toMatch(/date limite/i);
    expect(messageErreur(401, fr)).toMatch(/nouveau lien/i);
    expect(messageErreur(413, fr)).toMatch(/trop volumineux/i);
    expect(messageErreur(503, fr)).toMatch(/30 secondes/);
  });

  it('parle la langue de l’écran', () => {
    expect(messageErreur(423, en)).toMatch(/deadline/i);
  });

  it('ne laisse jamais passer un message vide ou technique', () => {
    for (const statut of [0, 400, 401, 403, 404, 409, 413, 415, 423, 429, 500, 502, 503, 504, 599]) {
      for (const dico of [fr, en]) {
        const message = messageErreur(statut, dico);
        expect(message, `statut ${statut}`).toBeTruthy();
        expect(message).not.toMatch(/tus:|ProgressEvent|response code/);
      }
    }
  });
});
