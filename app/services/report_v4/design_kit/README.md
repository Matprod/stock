# Kit de direction artistique, rapport staff MAUNA

À copier tel quel dans le dossier design/ de report_v4 (R7, étape 3). Cursor ne réécrit pas ces fichiers : il les branche.

## Fichiers

- theme.css : couleurs, polices, tailles, page A4, règles d'impression, classes des éléments. Seule source de style.
- fonts/ : Barlow et Barlow Condensed en woff2 (licence SIL OFL, fonts/OFL.txt), avec accents d'Europe de l'Est, ≥ ≤ et signe moins.
- brief.md : direction artistique donnée au Designer à chaque rapport (en anglais, comme les autres consignes).
- review.md : grille de relecture des captures, appliquée par le Designer à ses pages.
- planche.html : planche de style en deux pages (couleurs, typographie, éléments, catalogue des graphiques, à faire / à ne pas faire). Pour toi et pour Cursor, jamais envoyée au Designer.
- references/en/ et references/fr/ : les 12 pages de référence en anglais (langue de référence) et en français, mêmes joueurs et chiffres fictifs. Le code envoie le jeu qui correspond à la langue de la demande.
- references/src/ : le code qui produit ces pages (REF_LOCALE=en ou fr node build.js <dossier>). charts.js est la spécification de chart_svg : mêmes tailles, mêmes classes, mêmes règles d'étiquettes.
- apercu/ : les 12 pages en anglais et en français, et la planche, imprimées en PDF A4 comme le fera le pipeline.

## Pages de référence envoyées au Designer

Pas les 12 à chaque fois (environ 100 Ko). Le code choisit selon le contrat de la demande :

| Toujours | 02-summary |
|---|---|
| Scores de l'équipe demandés | 03-team-matrix |
| Charge, ACWR, sRPE | 04-load-acwr |
| GPS par poste | 05-positions |
| Bien-être, sommeil, fatigue | 06-wellness |
| Blessures, disponibilité | 07-availability |
| Match dans la période | 08-match |
| Fiches individuelles | 09-player-sheet |
| Rapport de 4 pages ou plus | 00-cover, 10-data-method |
| Tableau long | 11-appendix-table |

Au plus 4 pages de référence par rapport. Le sommaire (01-contents) est produit par le code, il sert de modèle au code, pas au Designer.

## Couleurs

Orange = risque, bleu = performance, gris = référence. Pour distinguer des joueurs sur une autre mesure : encre, vert, magenta (validés pour le daltonisme sur toutes les paires). La couleur d'accent ne porte jamais une donnée.
