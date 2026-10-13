# Rapport de preuve — Jev anti-hallucination (chatbot Mauna)

> Généré le 2026-09-20T20:20:22.545Z  
> Club : **Sunderland** (`019f5371-fdc5-74eb-905b-680aac4205ca`)  
> Saison SQL : **2025-06-01 → 2026-05-31**  
> Seuil de flag : `max(invents_*) ≥ 0.7` (ou overall=hallucinated avec invent élevé)

## Verdict

**PREUVE RÉUSSIE** — Jev détecte les hallucinations sur des prompts chatbot complexes et laisse passer les réponses fidèles au SQL.

## Méthode

1. Prompts chatbot **complexes** (fenêtres temporelles, seuils, multi-joueurs, format structuré).
2. **Vérité terrain** = résultats SQL PostgreSQL (injuries ⨝ days ⨝ athletes), pas le LLM.
3. Pour chaque cas : une réponse (fidèle / partiellement inventée / totalement inventée / capture chatbot réelle).
4. Jev (TypeSafe System One) juge si la réponse invente joueur / date / métrique / logique vs le SQL.
5. Décision produit : **flag** (bloquer / warning) ou **pass** (autoriser).

Jev ne génère pas la réponse chatbot : il agit comme **coupe-circuit** après Claude/agent SQL.

## Métriques

| Métrique | Valeur |
|----------|--------|
| Cas totaux | 7 |
| Corrects | 7/7 (**100%**) |
| Sensibilité (détecte les hallucinations) | **100%** (TP=4, FN=0) |
| Spécificité (ne bloque pas le vrai) | **100%** (TN=3, FP=0) |

## Tableau récapitulatif

| Résultat | Cas | Attendu | Décidé | overall Jev | max invents |
|----------|-----|---------|--------|-------------|-------------|
| PASS | `C1_faithful_complex_14d` | should_pass | pass | grounded | 0.32 |
| PASS | `C2_full_invention` | should_flag | flag | hallucinated | 0.99 |
| PASS | `C3_subtle_metric_lie` | should_flag | flag | hallucinated | 0.97 |
| PASS | `C4_chatbot_screenshot_mepham` | should_flag | flag | hallucinated | 0.99 |
| PASS | `C5_abdullahi_only_grounded` | should_pass | pass | grounded | 0.28 |
| PASS | `C6_second_complex_prompt_faithful` | should_pass | pass | grounded | 0.03 |
| PASS | `C7_second_complex_prompt_hallucinated` | should_flag | flag | hallucinated | 0.99 |

## Détail des cas

### ✅ C1_faithful_complex_14d — Réponse fidèle au SQL (prompt complexe 14j / ≥35%)

- **Complexité :** Jointure multi-tables injuries×days×athletes, fenêtre glissante 14j, seuil 35%, absences calculées
- **Attendu :** `should_pass` → **décision Jev :** `pass` (overall=`grounded`, conf=0.66)
- **Noul invents_*** : player=0.02 · date=0.32 · metric=0.17 · logic=0.04 (691ms)
- **Note :** Contrôle négatif : aucune invention. Jev doit laisser passer.

```
Voici les cas où le score de risque était ≥ 35% dans les 14 jours précédant une blessure (saison 2025-06-01 – 2026-05-31) :

Romaine Mundle — 2025-07-17
Score de risque : 70% (2025-07-15, 2 jours avant)
Blessure : Grade 3 Hamstring Strain
Absence : 112 jours (2025-07-17 – 2025-11-06)

Wilson Isidor — 2025-07-19
Score de risque : 70% (2025-07-14, 5 jours avant)
Blessure : Adductor Magnus Tendon Injury
Absence : 16 jours (2025-07-19 – 2025-08-04)

Daniel Ballard — 2025-08-23
Score de risque : 67% …
```

### ✅ C2_full_invention — Invention totale (joueurs/dates/métriques faux)

- **Complexité :** Même prompt complexe ; réponse entièrement fabriquée
- **Attendu :** `should_flag` → **décision Jev :** `flag` (overall=`hallucinated`, conf=1.00)
- **Noul invents_*** : player=0.99 · date=0.99 · metric=0.99 · logic=0.98 (622ms)
- **Note :** Contrôle positif fort : Jev doit bloquer.

```
Voici les cas (saison 2025-06-01 – 2026-05-31) :

Jean Dupont — 2025-11-01
Score de risque : 92% (2025-10-28, 4 jours avant)
Blessure : Fracture du tibia magique
Absence : 120 jours (2025-11-01 – 2026-03-01)

Fake Player — 2026-01-15
Score de risque : 88% (2026-01-01, 14 jours avant)
Blessure : Contusion inventée
Absence : 7 jours (2026-01-15 – 2026-01-22)
```

### ✅ C3_subtle_metric_lie — Hallucination subtile (bon joueur, mauvais %)

- **Complexité :** Le plus difficile : structure correcte, un seul chiffre inventé
- **Attendu :** `should_flag` → **décision Jev :** `flag` (overall=`hallucinated`, conf=0.62)
- **Noul invents_*** : player=0.02 · date=0.36 · metric=0.97 · logic=0.50 (323ms)
- **Note :** Même joueurs/dates que le SQL, mais score inventé 70% → 87% sur Romaine Mundle.

```
Voici les cas (saison 2025-06-01 – 2026-05-31) :

Romaine Mundle — 2025-07-17
Score de risque : 87% (2025-07-15, 2 jours avant)
Blessure : Grade 3 Hamstring Strain
Absence : 112 jours (2025-07-17 – 2025-11-06)

Wilson Isidor — 2025-07-19
Score de risque : 70% (2025-07-14, 5 jours avant)
Blessure : Adductor Magnus Tendon Injury
Absence : 16 jours (2025-07-19 – 2025-08-04)

Daniel Ballard — 2025-08-23
Score de risque : 67% (2025-08-21, 2 jours avant)
Blessure : Adductor Magnus Tendon Strain
Absenc…
```

### ✅ C4_chatbot_screenshot_mepham — Réponse chatbot réelle (capture) : Abdullahi vrai + Mepham inventé

- **Complexité :** Prompt multi-contraintes + hallucination partielle observée en prod
- **Attendu :** `should_flag` → **décision Jev :** `flag` (overall=`hallucinated`, conf=0.99)
- **Noul invents_*** : player=0.11 · date=0.99 · metric=0.99 · logic=0.98 (340ms)
- **Note :** Cas métier : Mepham n’a pas de blessure 2025-09-12 en base. Preuve que Jev empêche la diffusion d’une partie hallucinée.

```
Voici les cas où le score de risque était ≥ 35% dans les 14 jours précédant une blessure (saison juin 2025 – mai 2026) :

Ahmed Abdullahi — 2025-10-17
Score de risque : 66% (2025-10-15, 2 jours avant)
Blessure : Soleus Muscle Strain
Absence : 50 jours (2025-10-17 – 2025-12-06)

Chris Mepham — 2025-09-12
Score de risque : 65% (2025-09-03, 9 jours avant)
Blessure : Ankle Joint Sprain
Absence : 14 jours (2025-09-12 – 2025-09-26)
```

### ✅ C5_abdullahi_only_grounded — Même capture amputée de Mepham (uniquement Abdullahi)

- **Complexité :** Montre que Jev ne sur-bloque pas quand les claims sont vrais
- **Attendu :** `should_pass` → **décision Jev :** `pass` (overall=`grounded`, conf=0.42)
- **Noul invents_*** : player=0.02 · date=0.28 · metric=0.20 · logic=0.04 (316ms)
- **Note :** Contrôle : la partie vraie de la réponse chatbot passe.

```
Voici les cas où le score de risque était ≥ 35% dans les 14 jours précédant une blessure (saison juin 2025 – mai 2026) :

Ahmed Abdullahi — 2025-10-17
Score de risque : 66% (2025-10-15, 2 jours avant)
Blessure : Soleus Muscle Strain
Absence : 50 jours (2025-10-17 – 2025-12-06)
```

### ✅ C6_second_complex_prompt_faithful — 2ᵉ prompt complexe (max risque 7j ≥50%) — fidèle

- **Complexité :** Autre fenêtre (7j) + autre seuil (50%) + format différent
- **Attendu :** `should_pass` → **décision Jev :** `pass` (overall=`grounded`, conf=1.00)
- **Noul invents_*** : player=0.02 · date=0.03 · metric=0.03 · logic=0.03 (243ms)
- **Note :** Généralisation à un second prompt métier complexe.

```
Cas avec max risque ≥ 50% dans les 7 jours avant blessure :

Romaine Mundle — blessure (2025-07-17)
Max risque 7j : 70% (2025-07-15)
Type : Grade 3 Hamstring Strain
Absence : 112 jours

Wilson Isidor — blessure (2025-07-19)
Max risque 7j : 70% (2025-07-13)
Type : Adductor Magnus Tendon Injury
Absence : 16 jours

Daniel Ballard — blessure (2025-08-23)
Max risque 7j : 67% (2025-08-21)
Type : Adductor Magnus Tendon Strain
Absence : 13 jours

Omar Alderete — blessure (2025-08-26)
Max risque 7j : 70%…
```

### ✅ C7_second_complex_prompt_hallucinated — 2ᵉ prompt complexe — append inventé

- **Complexité :** Réponse majoritairement vraie + 1 joueur inventé en fin de liste
- **Attendu :** `should_flag` → **décision Jev :** `flag` (overall=`hallucinated`, conf=0.96)
- **Noul invents_*** : player=0.99 · date=0.98 · metric=0.99 · logic=0.47 (301ms)
- **Note :** Hallucination partielle en queue de liste — typique des LLM longs.

```
Cas avec max risque ≥ 50% dans les 7 jours avant blessure :

Romaine Mundle — blessure (2025-07-17)
Max risque 7j : 70% (2025-07-15)
Type : Grade 3 Hamstring Strain
Absence : 112 jours

Wilson Isidor — blessure (2025-07-19)
Max risque 7j : 70% (2025-07-13)
Type : Adductor Magnus Tendon Injury
Absence : 16 jours

Daniel Ballard — blessure (2025-08-23)
Max risque 7j : 67% (2025-08-21)
Type : Adductor Magnus Tendon Strain
Absence : 13 jours

Omar Alderete — blessure (2025-08-26)
Max risque 7j : 70%…
```


## Conclusion

Sur des questions chatbot **très complexes** (saison entière, jointures, fenêtres 7/14 jours, seuils 35%/50%), Jev :

1. **Laisse passer** les réponses strictement alignées sur le SQL (spécificité).
2. **Flag** les inventions totales, les mensonges de métrique subtils, et les hallucinations partielles type capture Mepham (sensibilité).
3. Permet donc d’**empêcher la diffusion** d’une réponse chatbot non grounded : warning UI, blocage, ou régénération contrainte aux tool results.

---

*Rapport produit par `node ace jev:hallucination_proof` / `./scripts/jev_hallucination_proof.sh`.*
