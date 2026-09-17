#!/usr/bin/env bash
#
# Sauvegarde hors machine du volume `uploads` de JT ALWM.
#
# POURQUOI
# --------
# `DEPLOY_VPS.md` §11 archive déjà le volume — mais vers `/var/backups` sur le
# même disque. Cela protège d'une fausse manœuvre ou d'un conteneur perdu ; pas
# de la perte du VPS : panne disque, incident hébergeur, suspension de compte.
#
# Or ce volume porte ce qui est irremplaçable. Les métadonnées se répliquent
# vers Upstash ; les **rushes** non. Ils arrivent une fois par semaine, depuis
# sept pays, souvent sur de mauvaises connexions. Un correspondant ne réenvoie
# pas facilement ce qu'il a envoyé samedi.
#
# CE QUE FAIT CE SCRIPT, ET POURQUOI AINSI
# ----------------------------------------
# `rclone sync` plutôt qu'une archive quotidienne : le volume grossit d'une
# semaine de vidéos à l'autre, et retélécharger l'intégralité chaque nuit
# coûterait la bande passante et le stockage de tout l'historique, tous les
# jours. La synchronisation n'envoie que ce qui a changé.
#
# `--backup-dir` daté : `sync` supprime à la destination ce qui a disparu à la
# source. Sans lui, une suppression accidentelle se propagerait et la
# sauvegarde la recopierait fidèlement — ce qui est exactement ce qu'on veut
# éviter. Avec lui, ce qui disparaît est écarté dans un dossier daté, pas
# détruit.
#
# Le volume est monté **en lecture seule** (`:ro`) : une sauvegarde ne doit pas
# pouvoir abîmer ce qu'elle sauvegarde.
#
# USAGE
#   REMOTE=r2:jt-alwm-sauvegarde ./scripts/sauvegarde-hors-site.sh
#   REMOTE=… ./scripts/sauvegarde-hors-site.sh --essai   # rien n'est écrit
#
# VARIABLES
#   REMOTE          (requis) destination rclone, ex. `r2:jt-alwm-sauvegarde`
#   VOLUME          volume Docker source        (défaut : jt-alwm_uploads_volume)
#   RCLONE_CONF     config rclone sur l'hôte    (défaut : ~/.config/rclone/rclone.conf)
#   PLANCHER        refuse de synchroniser en dessous de N fichiers (défaut : 1)
#   RCLONE_BIN      rclone de l'hôte au lieu de l'image Docker (tests, dépannage)
#
set -euo pipefail

REMOTE="${REMOTE:-}"
VOLUME="${VOLUME:-jt-alwm_uploads_volume}"
RCLONE_CONF="${RCLONE_CONF:-$HOME/.config/rclone/rclone.conf}"
PLANCHER="${PLANCHER:-1}"
VERROU="${VERROU:-/tmp/jt-alwm-sauvegarde.lock}"

ESSAI=0
[[ "${1:-}" == "--essai" || "${1:-}" == "--dry-run" ]] && ESSAI=1

horodatage() { date -u +%Y-%m-%dT%H-%M-%SZ; }
dire() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
echouer() { printf '[%s] ERREUR : %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; exit 1; }

# rclone tourne dans son image officielle : rien à installer sur l'hôte, et la
# version ne dérive pas avec les mises à jour du système. `RCLONE_BIN` permet
# d'utiliser un binaire local — c'est ce dont les tests se servent.
lancer_rclone() {
  if [[ -n "${RCLONE_BIN:-}" ]]; then
    "$RCLONE_BIN" "$@"
  else
    docker run --rm \
      -v "${VOLUME}:/data:ro" \
      -v "${RCLONE_CONF}:/config/rclone/rclone.conf:ro" \
      rclone/rclone "$@"
  fi
}

[[ -n "$REMOTE" ]] || echouer "REMOTE non défini. Exemple : REMOTE=r2:jt-alwm-sauvegarde $0"

if [[ -z "${RCLONE_BIN:-}" && ! -f "$RCLONE_CONF" ]]; then
  echouer "Configuration rclone introuvable : $RCLONE_CONF (lancer « rclone config » d'abord)"
fi

# Un seul passage à la fois : une sauvegarde lente qui chevauche la suivante
# ferait deux `sync` concurrents sur la même destination.
exec 9>"$VERROU"
flock -n 9 || echouer "Une sauvegarde est déjà en cours (verrou $VERROU)"

DATE="$(horodatage)"
dire "Sauvegarde $DATE — volume $VOLUME → $REMOTE"

# ── Le garde-fou qui compte ────────────────────────────────────────────────
# Si le volume ne se monte pas, ou se monte vide, `sync` viderait la
# destination. Le `--backup-dir` écarterait tout au lieu de le détruire, mais
# on préfère ne pas en arriver là : une source anormalement vide est un
# symptôme, pas une instruction.
TAILLE="$(lancer_rclone size /data --json 2>/dev/null || true)"
FICHIERS="$(printf '%s' "$TAILLE" | sed -n 's/.*"count"[: ]*\([0-9]*\).*/\1/p')"
[[ -n "$FICHIERS" ]] || echouer "Impossible de lire la taille de la source (volume $VOLUME monté ?)"

dire "Source : $FICHIERS fichier(s)"
if (( FICHIERS < PLANCHER )); then
  echouer "Source anormalement vide ($FICHIERS < $PLANCHER). Rien n'est envoyé — vérifiez que le volume est bien monté."
fi

# ── La synchronisation ─────────────────────────────────────────────────────
ARGS=(
  sync /data "${REMOTE}/courant"
  --backup-dir "${REMOTE}/versions/${DATE}"
  --transfers 4
  --checkers 8
  # Les vidéos ne changent pas après leur dépôt : comparer taille et date
  # évite de relire des gigaoctets pour calculer des sommes de contrôle.
  --size-only
  --stats 30s
  --stats-one-line
)
(( ESSAI )) && ARGS+=(--dry-run)

if (( ESSAI )); then
  dire "Mode essai : rien ne sera écrit."
fi

lancer_rclone "${ARGS[@]}" || echouer "La synchronisation a échoué"

# ── L'index, versionné à part ──────────────────────────────────────────────
# `store.json` est petit et c'est l'index de tout le reste : quelles semaines,
# quels pays, quel fichier appartient à quel reportage. Sans lui, les vidéos
# restaurées sont un tas de fichiers anonymes. Il mérite une copie datée à
# chaque passage, pas seulement la dernière version.
if (( ! ESSAI )); then
  lancer_rclone copyto /data/store.json "${REMOTE}/etat/store-${DATE}.json" 2>/dev/null \
    && dire "Index copié : etat/store-${DATE}.json" \
    || dire "Pas de store.json à la racine du volume — index non copié."
fi

dire "Terminé."
