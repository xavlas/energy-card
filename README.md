# Energy

Une carte Lovelace personnalisée pour Home Assistant qui visualise un système énergétique : des nœuds (production, consommation, échange réseau, stockage) reliés par des lignes animées à un cercle central représentant la maison. Un fichier JS unique, sans étape de build, entièrement configurable en YAML.

## Installation

### Via HACS

```
1. HACS → menu (⋮) → Dépôts personnalisés (Custom repositories)
2. Ajouter l'URL du dépôt GitHub, catégorie "Lovelace"
3. Installer "Energy" ; la ressource est ajoutée automatiquement
```

### Manuelle

```
1. Copier energy-card.js dans /config/www/
2. Réglages → Tableaux de bord → Ressources → Ajouter
   URL: /local/energy-card.js   Type: Module JavaScript
3. Ajouter la carte: type: custom:energy-card
```

## Configuration

| Clé | Type | Défaut | Rôle |
|-----|------|--------|------|
| `title` | string | `Système énergétique` | Titre de la carte |
| `center.entity` | string | — (requis) | Entité représentant la puissance de la maison |
| `center.icon` | string | `mdi:home` | Icône du cercle central |
| `nodes` | liste | — (requis, au moins 1) | Liste des nœuds (voir ci-dessous) |

### Nœud (`nodes[]`)

| Clé | Type | Défaut | Rôle |
|-----|------|--------|------|
| `side` | string | — (requis) | `top-left`, `top-right`, `left`, `right` ou `bottom` |
| `type` | string | — (requis) | `production`, `consumption`, `grid` ou `storage` — pilote la couleur et l'icône par défaut |
| `entity` | string | — (requis sauf `type: grid`) | Entité dont l'état est affiché |
| `import_entity` / `export_entity` | string | — (requis pour `type: grid`) | Entités d'import/export réseau |
| `title` | string | Libellé du type | Titre affiché sur la carte |
| `icon` | string | Icône par défaut du type | Icône mdi |

La légende en bas de carte est générée automatiquement à partir des types utilisés.

## Examples

Voir [`examples/lovelace-examples.yaml`](examples/lovelace-examples.yaml) pour une configuration complète correspondant à la maquette d'origine.

## Tests

```
npm test
```

Harnais de test visuel : `./test/serve.sh` (ouvre `test/harness.html` dans le navigateur avec des données simulées).

## License

MIT — see [LICENSE](LICENSE).
