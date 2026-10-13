const NUTRITION_ANALYTICS_INSIGHTS: Record<string, number> = {
  "Lipides": 70,
  "Glucides": 70,
  "Protéines": 70,
  "Micro-nutriments": 100,
}

const HEALTH_ANALYTICS_INSIGHTS: Record<string, number> = {
  "Énergie": 100,
  "Humeur": 100,
  "Détente": 100,
  "Fatigue_Travel": 100,
  "Symptômes": 100,
  "Variabilité de la fréquence cardiaque": 100,
  "Fréquence cardiaque au repos": 100,
  "Douleurs à l'effort": 100,
  "Douleurs hors effort": 100,
}

const ACTIVITY_ANALYTICS_INSIGHTS: Record<string, number> = {
  "Ratio de charge d'entraînement": 100,
  "Récupération": 67,
  "CE Variabilité": 100,
  "Fréquence d'entraînement": 100,
  "CE Moyenne": 100,
}

const SLEEP_ANALYTICS_INSIGHTS: Record<string, number> = {
  "Qualité": 70,
  "Quantité": 70,
  "Variabilité": 87.5,
  "Sommeil réparateur": 75,
  "Dette de sommeil": 75,
}

export const ANALYTICS_INSIGHTS = [
  ...Object.entries(NUTRITION_ANALYTICS_INSIGHTS).map(([label, optimalValue]) => ({
    label,
    optimalValue,
  })),
  ...Object.entries(HEALTH_ANALYTICS_INSIGHTS).map(([label, optimalValue]) => ({
    label,
    optimalValue,
  })),
  ...Object.entries(ACTIVITY_ANALYTICS_INSIGHTS).map(([label, optimalValue]) => ({
    label,
    optimalValue,
  })),
  ...Object.entries(SLEEP_ANALYTICS_INSIGHTS).map(([label, optimalValue]) => ({
    label,
    optimalValue,
  })),
]