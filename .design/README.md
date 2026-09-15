# Maquettes du studio de montage

Les planches sont des Design Components (`*.dc.html`), assemblées en un
canevas unique publié en Artifact. `canvas.json` place les planches et porte
les notes.

## Régénérer le canevas

Le fichier assemblé (`studio-montage-jt-alwm.html`, ~2,5 Mo) n'est pas
versionné : il embarque l'éditeur entier et se reconstruit depuis les sources.

```bash
node "<skill design>/seed-canvas.mjs" \
  --template "<skill design>/payload.template.html" \
  --out studio-montage-jt-alwm.html \
  --title "Studio de montage JT ALWM" \
  --artboard Main.dc.html --artboard Avant.dc.html \
  --artboard Animations.dc.html --artboard Inspecteur.dc.html \
  --artboard Studio.dc.html \
  --canvas canvas.json
```

## Les planches

| Fichier | Ce qu'elle montre |
|---|---|
| `Avant.dc.html` | Le panneau d'habillage actuel, annoté aux endroits sans effet |
| `Main.dc.html` | Le catalogue rangé par moment du JT, avec vignettes |
| `Animations.dc.html` | Le choix d'animation par l'aperçu animé |
| `Inspecteur.dc.html` | L'inspecteur replié sur ses valeurs courantes |
| `Studio.dc.html` | L'ensemble en place, à 1440 px |

Les couleurs sont reprises de `frontend/src/index.css` : les deux bleus du
logo (`--brand-navy`, `--brand-sky`), la palette sombre `--editor-*`, et Sora.
Toute évolution de la charte doit être répercutée ici, sinon la maquette ment.
