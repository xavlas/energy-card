# energy-card — design

## Contexte

Carte Lovelace personnalisée pour Home Assistant qui visualise un système énergétique sous forme de nœuds (production, consommation, échange réseau, stockage) reliés à un cercle central par des connexions animées, sur le modèle d'une maquette fournie par l'utilisateur. Nouveau repo dédié `xavlas/energy`, packaging HACS identique aux cartes `gauge` et `vumetre` déjà livrées (fichier JS unique sans étape de build, fonctions pures exportées pour les tests `node --test`).

## Schéma de configuration

```yaml
type: custom:energy-card
title: Système énergétique
center:
  entity: sensor.maison_puissance
  icon: mdi:home          # optionnel, défaut mdi:home
nodes:
  - side: top-left
    type: production       # production | consumption | grid | storage
    entity: sensor.solaire_puissance
    title: Solaire
    icon: mdi:white-balance-sunny   # optionnel, défaut selon type
  - side: top-right
    type: consumption
    entity: sensor.piscine_puissance
    title: Piscine
    icon: mdi:pool
  - side: left
    type: grid
    title: Réseau
    icon: mdi:transmission-tower
    import_entity: sensor.reseau_import
    export_entity: sensor.reseau_export
  - side: bottom
    type: storage
    entity: sensor.ballon_puissance
    title: Ballon
    icon: mdi:battery
```

- `side` ∈ `top-left, top-right, left, right, bottom`. Plusieurs nœuds sur le même côté s'empilent verticalement.
- `type` pilote la couleur (orange=production, vert=consumption, bleu=grid, violet=storage), l'icône par défaut, et le texte du badge (sauf `grid`, qui affiche toujours "Échange" avec deux flèches import/export).
- La légende en bas de carte est générée automatiquement à partir des types réellement présents dans `nodes`.
- `entity` est requis pour tout nœud sauf `type: grid`, qui requiert `import_entity` et `export_entity` à la place. Validation à `setConfig`, erreur explicite sinon (cohérent avec `gauge`/`vumetre`).

## Layout (HTML/CSS)

Conteneur `display:grid`, 3 colonnes (gauche / centre / droite) × 3 lignes (haut / milieu / bas). Chaque nœud occupe la cellule correspondant à son `side` ; le cercle central occupe toujours `centre/milieu`. Les nœuds sont des `ha-card` standard, bordure et glow colorés selon `type` (`border-color` + `filter: drop-shadow`). Titre de carte et menu (⋮) en en-tête HA classique au-dessus de la grille.

## Connexions (couche SVG)

Un `<svg>` plein cadre en position `absolute` au-dessus de la grille, recalculé via `ResizeObserver` sur le conteneur. Pour chaque nœud : point de sortie = bord de la carte le plus proche du centre, point d'entrée = point sur le cercle central le plus proche du nœud. Tracé en Bézier cubique avec un coude à mi-chemin (fidèle à la maquette), couleur = couleur du `type` du nœud.

Un point lumineux (`<circle>`) se déplace sur chaque tracé via `requestAnimationFrame` + `path.getPointAtLength()`, vitesse constante en v1. Sens du déplacement :
- `production` et `grid` (import) : nœud → centre
- `consumption` et `storage` : centre → nœud

## Cercle central

Anneau en `conic-gradient` fixe (orange → vert → bleu → violet), purement décoratif — ne reflète pas dynamiquement les nœuds connectés. Icône configurable (défaut `mdi:home`), valeur issue de `center.entity`, badge "Consommation" toujours affiché.

## Sparklines

Chaque carte (nœuds + centre) affiche une mini-courbe de tendance en bas, basée sur l'historique réel de son entité :
- récupération via `hass.callApi('GET', 'history/period/...')`, fenêtre ~2h
- rafraîchissement toutes les ~5 minutes (pas à chaque tick d'animation)
- downsampling en ~12 points avant tracé
- rendu en `<svg><path>` avec remplissage en dégradé coloré par `type`
- si l'historique est indisponible (entité sans recorder, erreur API) : ligne plate affichée, pas d'exception

## Formatage des valeurs

Fonction pure `formatPower(watts)` :
- `< 1000` → `"123 W"`
- `>= 1000` → `"12,3 kW"` (virgule décimale FR)

Utilisée pour tous les nœuds, y compris les deux valeurs (import/export) du nœud `grid`.

## Gestion des erreurs

- `setConfig` : entité(s) manquante(s) sur un nœud → `throw new Error(...)` explicite, comme `gauge-card`/`vumetre-card`.
- À l'exécution (`set hass`) : entité absente de `hass.states` → le nœud affiche `—` au lieu de planter.
- Échec de récupération d'historique → sparkline en ligne plate, pas de blocage du rendu de la carte.

## Tests (`node --test`, fonctions pures exportées)

- `normalizeConfig` — validation `nodes`/`center`, application des défauts par `type`
- `formatPower`
- `colorForType`
- `buildConnectorPath(fromPoint, toPoint)` — génère la chaîne de tracé Bézier
- `downsampleHistory(rawPoints, n)`

## Packaging

Identique aux repos `gauge` et `vumetre` : `hacs.json`, `README.md`, `LICENSE` (MIT, Xavier Lassus), `package.json` (`type: module`, `npm test` → `node --test`), `examples/lovelace-examples.yaml`, `test/`.
