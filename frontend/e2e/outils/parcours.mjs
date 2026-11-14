/**
 * Les gestes communs aux parcours : entrer comme correspondant, déverrouiller
 * le montage, lire ce que le serveur a reçu, relever les erreurs de la page.
 */
import { expect } from '@playwright/test';
import { MOT_DE_PASSE_MONTAGE, URL_API } from './banc.mjs';

const ENTETE_MONTAGE = { 'X-Admin-Password': MOT_DE_PASSE_MONTAGE };

/** La semaine où l'on envoie. */
export async function semaineActive(request) {
  const semaines = await (await request.get(`${URL_API}/api/weeks`)).json();
  return semaines.find((s) => s.status === 'active') || semaines[0];
}

/** Les fichiers reçus d'un pays, tels que le serveur les a enregistrés. */
export async function fichiersRecus(request, semaine, pays) {
  const r = await request.get(`${URL_API}/api/uploads/${semaine}/${pays}`, { headers: ENTETE_MONTAGE });
  expect(r.ok(), `liste des fichiers de ${pays}`).toBeTruthy();
  const corps = await r.json();
  return Array.isArray(corps) ? corps : corps.files || [];
}

/**
 * Relève tout ce qui casse pendant un parcours : exceptions de la page,
 * erreurs écrites dans la console, réponses en erreur du serveur. Les tests
 * finissent par `expect(erreurs()).toEqual([])`.
 *
 * `toleres` : des réponses attendues (un refus qu'on provoque exprès).
 */
export function surveillerErreurs(page, { toleres = [] } = {}) {
  const liste = [];
  page.on('pageerror', (e) => liste.push(`exception : ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // Le détail d'une réponse en erreur est relevé ci-dessous, avec son adresse.
    if (/Failed to load resource/.test(m.text())) return;
    // La phrase que l'application écrit quand une requête n'aboutit pas. Elle
    // l'écrit aussi quand on quitte la page en plein chargement, ce qui n'est
    // pas une panne : les vraies sont relevées juste en dessous, à la source.
    if (/Pas de connexion pour l’instant|No connection right now|Failed to fetch|NetworkError when attempting to fetch|Load failed/.test(m.text())) return;
    liste.push(`console : ${m.text().slice(0, 300)}`);
  });
  page.on('requestfailed', (r) => {
    const url = r.url();
    if (!url.includes('/api/') && !url.includes('/uploads/')) return;
    const raison = r.failure()?.errorText || 'raison inconnue';
    // Quitter ou recharger la page coupe ses requêtes en cours : normal.
    if (/ERR_ABORTED|NS_BINDING_ABORTED|cancell?ed/i.test(raison)) return;
    liste.push(`requête échouée (${raison}) : ${r.method()} ${url.replace(/^https?:\/\/[^/]+/, '')}`);
  });
  page.on('response', (r) => {
    const url = r.url();
    if (r.status() < 400 || !url.includes('/api/')) return;
    if (toleres.some((t) => (t instanceof RegExp ? t.test(url) : url.includes(t)))) return;
    liste.push(`réponse ${r.status()} : ${r.request().method()} ${url.replace(/^https?:\/\/[^/]+/, '')}`);
  });
  return () => liste;
}

/**
 * Entre dans l'espace d'envoi d'un pays comme un correspondant qui arrive
 * pour la première fois : conseils d'écriture lus, numéro WhatsApp donné,
 * nombre de reportages choisi.
 */
export async function entrerCommeCorrespondant(page, pays, { reportages = 1, numero = '670000000', titres = ['Le marché de Mokolo rouvre'] } = {}) {
  await page.goto(`/journalistes/${pays}`);
  const compris = page.getByRole('button', { name: 'J’ai compris' });
  const tel = page.locator('input[type=tel]:visible');
  await expect(tel.or(page.getByRole('button', { name: /WhatsApp :/ }).first())).toBeVisible();
  if (await tel.count()) {
    // Sur ordinateur, les conseils d'écriture s'ouvrent par-dessus à la
    // première visite — parfois un instant après le champ. On les referme
    // dès qu'ils sont là, jusqu'à pouvoir toucher le champ.
    await expect(async () => {
      if (await compris.isVisible()) await compris.click();
      await tel.click({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });
    await tel.pressSequentially(numero, { delay: 15 });
    const valider = page.getByRole('button', { name: 'Valider mon numéro' });
    await expect(valider, `numéro ${numero} refusé pour ${pays}`).toBeEnabled({ timeout: 5000 });
    await valider.click();
  }
  // Première visite : on choisit le nombre de reportages. Visite suivante :
  // le choix est déjà fait, l'écran propose seulement de le changer. On
  // attend que l'un des deux soit affiché avant de décider (sur un serveur
  // occupé, l'écran met un instant à arriver).
  const choix = page.getByRole('button', { name: new RegExp(`^${reportages} reportages?$`) }).filter({ visible: true }).first();
  const dejaChoisi = page.getByRole('button', { name: 'Changer le nombre' }).filter({ visible: true }).first();
  await expect(choix.or(dejaChoisi).first()).toBeVisible();
  if (!(await choix.isVisible())) return;
  await choix.click();
  // Chaque reportage reçoit son titre : c'est ce que la rédaction lit sur
  // le conducteur.
  const dialogue = page.getByRole('dialog', { name: /Votre reportage|Vos reportages/ });
  await expect(dialogue).toBeVisible();
  const champs = dialogue.getByRole('textbox');
  for (let i = 0; i < await champs.count(); i += 1) await champs.nth(i).fill(titres[i] || `Sujet ${i + 1}`);
  await dialogue.getByRole('button', { name: /Valider/ }).click();
  await expect(dialogue).toBeHidden();
}

/** Ouvre l'espace montage avec le mot de passe des tests. */
export async function deverrouillerMontage(page, chemin = '/monteurs') {
  await page.goto(chemin);
  const champ = page.locator('input[type=password]:visible').first();
  await champ.fill(MOT_DE_PASSE_MONTAGE);
  await page.locator('button:visible', { hasText: 'Déverrouiller' }).first().click();
  await expect(champ).toBeHidden({ timeout: 20_000 });
}

/** Attend qu'une condition sur le serveur devienne vraie (mesure, aperçu…). */
export async function attendre(condition, { delai = 60_000, pas = 500, message = 'condition' } = {}) {
  const fin = Date.now() + delai;
  let dernier;
  while (Date.now() < fin) {
    dernier = await condition();
    if (dernier) return dernier;
    await new Promise((r) => setTimeout(r, pas));
  }
  throw new Error(`${message} : toujours faux après ${delai / 1000} s`);
}

export { ENTETE_MONTAGE };

/**
 * Recalcule une liste de « ce qui manque encore » jusqu'à ce qu'elle soit
 * vide ou que le délai soit passé, et rend la dernière : le test la compare
 * à `[]`, et son message nomme ce qui manque.
 */
export async function restantsApres(calcul, { delai = 60_000, pas = 1000 } = {}) {
  const fin = Date.now() + delai;
  let restants = await calcul();
  while (restants.length && Date.now() < fin) {
    await new Promise((r) => setTimeout(r, pas));
    restants = await calcul();
  }
  return restants;
}
