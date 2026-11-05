/**
 * Reporter dans le montage ce qu'un panneau de l'inspecteur a modifié — et
 * seulement cela.
 *
 * L'INCIDENT : le panneau d'habillage garde une copie du clip prise à son
 * ouverture, et la renvoyait entière à chaque frappe. Si le plan avait été
 * rogné ou déplacé entre-temps dans la timeline, la frappe suivante
 * rétablissait l'ancienne durée : le rognage disparaissait sans un mot.
 */
export function fusionnerInspecteur(clips, clipModifie, champs) {
  if (!clipModifie) return clips;
  return clips.map((clip) => {
    if (clip.instanceId !== clipModifie.instanceId) return clip;
    const suivant = { ...clip };
    for (const champ of champs) {
      if (Object.prototype.hasOwnProperty.call(clipModifie, champ)) suivant[champ] = clipModifie[champ];
    }
    return suivant;
  });
}
