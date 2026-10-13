# Kit graphiques Report-v4

Spécification de graphique (`ChartSpec`), rendu en code, contrôles et opération douce `chart_op`. Le brief complet est dans le document « Graphiques de Report-v4 : spécification, rendu et édition douce (brief Cursor) ».

À placer **à côté** de `design-packs-kit/` : les imports sont relatifs (`../design-packs-kit/pack-lib.mjs`, `packs.json`).

    mon-dossier/
      design-packs-kit/
      chart-kit/        <- ce dossier

## Contenu

| Fichier | Rôle |
| --- | --- |
| `chart-spec.schema.json` | Schéma JSON de `ChartSpec` v1 : intention, références de données, entités avec rang de couleur, réglages bornés. Aucune valeur chiffrée, aucune couleur. |
| `chart-intents.json` | Table fermée intention vers formes permises, avec la forme par défaut et les règles. |
| `chart-lib.mjs` | `tokenMap`, `resolveTokens`, `validateSpec`, `buildOption`, `renderChart`, `renderChecked`, `checkOption`, `checkAdditive`, `applyChartOp`, `tableView`. Fonctions pures. |
| `soft-ops.schema.json` | Schéma des opérations douces, version 2 : `chart_op` agit sur la spécification (remplace les anciens noms `drop_empty_days`, `mark_lines`, `strip_visualMap`, `remap_encode`, `chart_metric`, qui modifiaient l'option brute) ; contient aussi `set_pack`. |
| `examples/` | Cinq spécifications et leurs jeux de données **synthétiques** (aucun joueur réel), exemple de `chart_op`. |
| `chart.test.mjs` | 20 tests (`node --test`). |
| `demo.mjs`, `shot.mjs` | Rendent les cinq exemples dans trois packs en SVG (rendu serveur ECharts) et en capture. |
| `previews/demo.png` | Résultat. Polices de repli (le bac à sable n'avait pas les polices du pack). |

## Commandes

    npm install        # echarts 5.5.1 et ajv (développement seulement)
    npm test           # attendu : 20 réussis, 0 échec
    npm run demo       # écrit demo.html ; pour la capture : npm i -D playwright puis node shot.mjs

## Formes implémentées

`line`, `bar`, `barh`, `hist`, `waterfall`, `diverging_bar`. À écrire : `dot`, `box`, `dot_band`, `table`, `area_stacked` (listées dans `formsToWrite`).

## Limites connues

- Les contrôles de ce kit portent sur l'option (couleurs, jetons, encodage, légende, relief, axe à zéro, additivité, fenêtre). Le chevauchement d'étiquettes et le débordement de page exigent le DOM : ce sont ceux de la phase F, à brancher après rendu.
- `applySeriesEncoding` de `pack-lib.mjs` choisit le tiret et le marqueur par position dans le tableau de séries. Ici le rendu les choisit par rang de couleur de l'entité (`slot`) ; pour que masquer un joueur ne change pas les autres, remplacer cette fonction ou ne plus l'appeler.
- `resolveTokens` est fourni ici ; à déplacer dans `pack-lib.mjs` si vous préférez.
- Dans le navigateur, `chart-intents.json` s'injecte avec `setIntents(json)` (pas de lecture de fichier).
- Aucun test avec les vraies données ni avec le code existant de Report-v4 : à faire à l'intégration.
