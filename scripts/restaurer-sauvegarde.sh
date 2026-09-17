#!/usr/bin/env bash
#
# Restauration d'une sauvegarde hors machine de JT ALWM.
#
# POURQUOI CE SCRIPT EXISTE
# -------------------------
# Une sauvegarde qu'on n'a jamais restaurée n'est pas une sauvegarde : c'est
# une intention. Ce script rend l'essai assez simple pour qu'on le fasse
# vraiment, et assez prudent pour qu'on puisse le faire sur une installation
# qui tourne.
#
# LA PRÉCAUTION PRINCIPALE
# ------------------------
# Par défaut, il restaure dans un **volume jetable**, jamais sur le volume de
# production. Écraser les données vivantes en croyant faire un essai est
# l'accident classique de la restauration — et il se produit précisément le
# jour où l'on est pressé. Écraser la production demande `--sur-la-production`,
# une confirmation tapée à la main, et les services arrêtés.
#
# USAGE
#   REMOTE=r2:jt-alwm-sauvegarde ./scripts/restaurer-sauvegarde.sh --lister
#   REMOTE=… ./scripts/restaurer-sauvegarde.sh                    # → volume d'essai
#   REMOTE=… ./scripts/restaurer-sauvegarde.sh --sur-la-production
#
# VARIABLES
#   REMOTE          (requis) source rclone, ex. `r2:jt-alwm-sauvegarde`
#   VOLUME          volume de production      (défaut : jt-alwm_uploads_volume)
#   VOLUME_ESSAI    volume jetable            (défaut : jt-alwm_restauration_essai)
#   RCLONE_CONF     config rclone sur l'hôte  (défaut : ~/.config/rclone/rclone.conf)
#   RCLONE_BIN      rclone de l'hôte au lieu de l'image Docker (tests, dépannage)
#
set -euo pipefail

REMOTE="${REMOTE:-}"
VOLUME="${VOLUME:-jt-alwm_uploads_volume}"
VOLUME_ESSAI="${VOLUME_ESSAI:-jt-alwm_restauration_essai}"
RCLONE_CONF="${RCLONE_CONF:-$HOME/.config/rclone/rclone.conf}"

ACTION="essai"
case "${1:-}" in
  --lister)             ACTION="lister" ;;
  --sur-la-production)  ACTION="production" ;;
  "")                   ACTION="essai" ;;
  *) printf 'Option inconnue : %s\n' "$1" >&2; exit 2 ;;
esac

dire() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
echouer() { printf '[%s] ERREUR : %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; exit 1; }

lancer_rclone() {
  local cible="$1"; shift
  if [[ -n "${RCLONE_BIN:-}" ]]; then
    "$RCLONE_BIN" "$@"
  else
    docker run --rm \
      ${cible:+-v "${cible}:/data"} \
      -v "${RCLONE_CONF}:/config/rclone/rclone.conf:ro" \
      rclone/rclone "$@"
  fi
}

[[ -n "$REMOTE" ]] || echouer "REMOTE non défini. Exemple : REMOTE=r2:jt-alwm-sauvegarde $0"

if [[ -z "${RCLONE_BIN:-}" && ! -f "$RCLONE_CONF" ]]; then
  echouer "Configuration rclone introuvable : $RCLONE_CONF"
fi

# ── Ce qu'il y a à restaurer ───────────────────────────────────────────────
if [[ "$ACTION" == "lister" ]]; then
  dire "État courant :"
  lancer_rclone "" size "${REMOTE}/courant" || echouer "Destination illisible — la sauvegarde a-t-elle déjà tourné ?"
  dire "Index datés disponibles :"
  lancer_rclone "" lsf "${REMOTE}/etat/" 2>/dev/null || dire "(aucun)"
  dire "Versions écartées (fichiers modifiés ou supprimés depuis) :"
  lancer_rclone "" lsf "${REMOTE}/versions/" --dirs-only 2>/dev/null || dire "(aucune)"
  exit 0
fi

# ── La restauration proprement dite ────────────────────────────────────────
if [[ "$ACTION" == "production" ]]; then
  CIBLE="$VOLUME"
  cat >&2 <<AVERTISSEMENT

  ⚠  Restauration SUR LE VOLUME DE PRODUCTION : $VOLUME

  Tout fichier présent ici et absent de la sauvegarde sera écrasé.
  Les services doivent être arrêtés (docker compose down), sans quoi le
  backend écrira par-dessus pendant la copie.

  Tapez exactement : restaurer la production
AVERTISSEMENT
  read -r reponse
  [[ "$reponse" == "restaurer la production" ]] || echouer "Confirmation refusée — rien n'a été touché."
else
  CIBLE="$VOLUME_ESSAI"
  dire "Restauration dans le volume jetable $CIBLE (la production n'est pas touchée)."
  dire "Pour restaurer réellement : $0 --sur-la-production"
fi

dire "Copie ${REMOTE}/courant → $CIBLE"
# `copy` et non `sync` : on ajoute et on remplace, on ne supprime jamais dans
# la cible. Une restauration ne doit pas pouvoir détruire ce qu'elle trouve.
lancer_rclone "$CIBLE" copy "${REMOTE}/courant" /data \
  --transfers 4 --checkers 8 --stats 30s --stats-one-line \
  || echouer "La restauration a échoué"

dire "Terminé. Vérifiez le contenu avant de redémarrer :"
dire "  docker run --rm -v ${CIBLE}:/data alpine sh -c 'ls /data | head; echo; du -sh /data'"
