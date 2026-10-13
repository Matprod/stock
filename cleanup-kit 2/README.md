# cleanup-kit : mesurer la simplification de Report-v4

Quatre scripts en lecture seule, sans dépendance (ils utilisent le TypeScript déjà installé dans le dépôt).

    ROOT=/chemin/du/depot-backend bash run.sh

- `reach.mjs` : fichiers de report_v4 / premium_report / report_builder atteignables depuis `report_v4/controller.ts`, et fichiers qui ne servent qu'aux anciennes routes.
- `dead-exports.cjs` : exports sans référence nulle part (code mort), exports utilisés seulement par les tests, exports utilisés seulement dans leur fichier.
- `function-sizes.cjs` : nombre de fonctions de plus de 50, 100, 200 lignes et les plus grosses.
- `run.sh` : lance tout, plus jscpd (duplications) et `tsc --noEmit` si disponibles.

Mesures de départ (13 octobre 2026) : voir la section "Simplification du code" de l'audit. À relancer après chaque phase du plan et à noter dans la PR : lignes avant / après.
