/**
 * Hamburg injury derivation rules — TypeScript port of injury_rules_for_backend.py.
 *
 * - mechanism (SAP): InjuryTypeText as-is, else inferInjuryTypeText(text)
 * - mechanism (rehab workbook): deriveRehabMechanism(text)
 * - tissue (all sources, only if empty): extractInjuryTissue(text); "unknown" → leave empty
 *
 * `text` = join of all available free-text fields (pathology + note + …).
 * Never overwrite a filled value. First matching rule wins (specific → generic).
 */

type Rule = readonly [RegExp, string]

const INJURY_TYPE_RULES: Rule[] = [
  [/\bacl\b.*\b(rupture|tear)\b/i, 'acl_rupture'],
  [/\bpcl\b.*\b(rupture|tear)\b/i, 'pcl_rupture'],
  [/\bmpfl\b.*\brupture\b/i, 'ligament_rupture'],
  [/\b(complete|total|subtotal|full)\s+rupture\b/i, 'rupture'],
  [/\bavulsion\b/i, 'avulsion'],
  [/\bstress\s+fracture\b/i, 'stress_fracture'],
  [/\bfracture\b/i, 'fracture'],
  [/\bdislocat(ion|ed|e)\b/i, 'dislocation'],
  [/\b(muscle\s+)?bundle\s+tear\b/i, 'muscle_bundle_tear'],
  [
    /\b(mfr|muscle\s+fib(er|re)\s+tear|fib(er|re)\s+tear|myofasc(ial|ia)\s+(micro[-\s]?(rupture|tear)|tear|microrupture))\b/i,
    'muscle_fiber_tear',
  ],
  [/\bfascial\s+tear\b/i, 'fascial_tear'],
  [/\bpartial\s+(tear|rupture)\b/i, 'partial_tear'],
  [/\brupture\b/i, 'rupture'],
  [/\b(tendon|ligament|meniscus|capsul\w*)\s+tear\b/i, 'tear'],
  [/\btear\b/i, 'tear'],
  [/\bstrain(ed|ing|s)?\b/i, 'strain'],
  [/\bsprain(ed|ing|s)?\b/i, 'sprain'],
  [/\bcontusion\b/i, 'contusion'],
  [
    /\b(acg|ac\s+joint)\b.*\b(demolition|separation|disruption)\b|tossy|rockwood/i,
    'ac_joint_separation',
  ],
  [/\bmuscle\s*\/?\s*tendon\s+injury\b/i, 'muscle_tendon_injury'],
  [/\bmuscle\s+injury\b|myofasc(ial|ia)\s+junction/i, 'muscle_injury'],
  [/\btendon\s+involvement\b/i, 'muscle_fiber_tear'],
  [/\bdamage\b/i, 'injury'],
  [/\b(bone\s+bruise|bone\s+marrow\s+edema|edema)\b/i, 'bone_bruise'],
  [/\bcartilage\s+defect\b/i, 'cartilage_defect'],
  [
    /\b(inflammation|irritation|tendinitis|tendinopathy|arthritis)\b/i,
    'inflammation',
  ],
  [/\boveruse\b/i, 'overuse'],
  [/\b(bulging\s+disc|disc|disk)\b/i, 'disc_injury'],
  [/\bnerve\s+damage\b/i, 'nerve_injury'],
  [/\b(hemorrhage|bleeding)\b/i, 'hemorrhage'],
  [/\bcapsul\w*\s+(tear|injur)\w*/i, 'capsule_injury'],
  [/stressfraktur|erm(ue|ü)dungsbruch/i, 'stress_fracture'],
  [/fraktur|\bbruch\b|gebrochen/i, 'fracture'],
  [/muskelfaserriss|faserriss/i, 'muscle_fiber_tear'],
  [/b(ue|ü)ndelriss/i, 'muscle_bundle_tear'],
  [/teilruptur|partialruptur|anriss/i, 'partial_tear'],
  [/\bruptur\b|\briss\b/i, 'rupture'],
  [/zerrung|dehnung/i, 'strain'],
  [/prellung|h(ae|ä)matom/i, 'contusion'],
  [/entz(ue|ü)ndung|reizung|tendinose|tendopat|insertionapatholog/i, 'inflammation'],
  [/sehnenriss/i, 'tear'],
  [/sehnenverletzung/i, 'muscle_tendon_injury'],
  [/luxation|verrenkung|ausgekugelt/i, 'dislocation'],
  [/(ue|ü)berlastung|chronisch|instabilit(ae|ä)t/i, 'overuse'],
]

const MECH_DISPLAY: Record<string, string> = {
  muscle_bundle_tear: 'bundle tear',
  muscle_fiber_tear: 'fiber tear',
  muscle_tendon_injury: 'muscle/tendon injury',
  ligament_rupture: 'rupture',
  acl_rupture: 'rupture',
  pcl_rupture: 'rupture',
  other: 'injury',
}

const TISSUE_RULES: Rule[] = [
  [/\bacl\b|anterior\s+cruciate/i, 'ACL'],
  [/\bpcl\b|posterior\s+cruciate/i, 'PCL'],
  [/\bmpfl\b/i, 'MPFL'],
  [/\bmcl\b|medial\s+collateral\s+ligament/i, 'MCL'],
  [/\blcl\b|lateral\s+collateral\s+ligament/i, 'LCL'],
  [/\blcm\b/i, 'LCM'],
  [/\bltta\b|\blt4\b|\bltl?a\b/i, 'LTTA'],
  [/\blfta\b|\bftta\b/i, 'LFTA'],
  [/\blfc\b/i, 'LFC'],
  [/\blucl\b/i, 'LUCL'],
  [/\brcl\b/i, 'RCL'],
  [/deltoid\s+ligament/i, 'deltoid ligament'],
  [/\bsyndesmo/i, 'syndesmotic ligament'],
  [/popliteofibular/i, 'popliteofibular ligament'],
  [/plantar\s+fascia/i, 'plantar fascia'],
  [/lateral\s+ligament/i, 'lateral ligament'],
  [/collateral\s+ligament/i, 'collateral ligament'],
  [/achilles/i, 'Achilles tendon'],
  [/biceps\s+tendon/i, 'biceps tendon'],
  [/patellar/i, 'patellar tendon'],
  [/biceps\s+(femor(is|us)|femur)/i, 'biceps femoris'],
  [/rectus\s+fem(oris|\.)/i, 'rectus femoris'],
  [/semitendinosus/i, 'semitendinosus'],
  [/semimembranosus/i, 'semimembranosus'],
  [/adductor\s+longus/i, 'adductor longus'],
  [/adductor\s+magnus/i, 'adductor magnus'],
  [/adductor\s+minimus/i, 'adductor minimus'],
  [/\badductor\b/i, 'adductor'],
  [/ili[eo]psoas|\bpsoas\b/i, 'iliopsoas'],
  [/pectineus/i, 'pectineus'],
  [/gastrocnemius/i, 'gastrocnemius'],
  [/\bsoleus\b/i, 'soleus'],
  [/gluteus|gluteal/i, 'gluteus'],
  [/obturator(ius)?\s+internus|\bobturator\b/i, 'obturator internus'],
  [/vastus\s+medialis/i, 'vastus medialis'],
  [/vastus\s+intermedius/i, 'vastus intermedius'],
  [/tibialis\s+anterior/i, 'tibialis anterior'],
  [/\bpopliteus\b/i, 'popliteus'],
  [/rectus\s+abdominis/i, 'rectus abdominis'],
  [/intercostal/i, 'intercostal'],
  [/anconeus/i, 'anconeus'],
  [/flexor\s+carpi/i, 'flexor carpi'],
  [/brachialis|brachioradialis/i, 'brachialis'],
  [/\bhamstring\b/i, 'hamstring'],
  [/\bcalf\b/i, 'calf'],
  [/metatars[ae]l\w*|metastarsale|metastases?/i, 'metatarsal'],
  [/\bfibula\b|\bweber\b\s*[abc]?\s*fracture/i, 'fibula'],
  [/\btibia\b/i, 'tibia'],
  [/malleolus/i, 'malleolus'],
  [/pubic\s+bone/i, 'pubic bone'],
  [/\brib\b/i, 'rib'],
  [/zygomatic/i, 'zygomatic arch'],
  [/femoral\s+head/i, 'femoral head'],
  [/humeral|humerus/i, 'humerus'],
  [/radial\s+head/i, 'radial head'],
  [/\btoe\b/i, 'toe'],
  [/\bwrist\b/i, 'wrist'],
  [/meniscus/i, 'meniscus'],
  [/cartilage/i, 'cartilage'],
  [/bulging\s+disc|\bdisc\b|\bdisk\b|lumbar\s+spine/i, 'disc'],
  [/\blabrum\b|joint\s+lip/i, 'labrum'],
  [/shoulder/i, 'shoulder'],
  [/elbow/i, 'elbow'],
  [/\bknee\b/i, 'knee'],
  [/\bankle\b/i, 'ankle'],
  [/\bhip\b/i, 'hip'],
  [/pelvi[cs]/i, 'pelvis'],
  [/\bacg\b|ac\s+joint|rockwood|tossy/i, 'AC joint'],
  [/\brectus\b/i, 'rectus femoris'],
  [/\bnerve\b/i, 'nerve'],
  [/capsul\w*/i, 'joint capsule'],
  [/\bgroin\b/i, 'groin'],
]

const GERMAN_TISSUE_RULES: Rule[] = [
  [/kreuzband/i, 'ACL'],
  [/innenband/i, 'MCL'],
  [/au(ss|ß)enband/i, 'lateral ligament'],
  [/sprunggelenk/i, 'ankle'],
  [/plantarfaszie/i, 'plantar fascia'],
  [/ac\s*gelenk|schultereckgelenk/i, 'AC joint'],
  [/klavikul|schl(ue|ü)sselbein/i, 'clavicle'],
  [/sar?torius/i, 'sartorius'],
  [/meniskus/i, 'meniscus'],
  [/wadenbein/i, 'fibula'],
  [/schienbein/i, 'tibia'],
  [/schambein/i, 'pubic bone'],
  [/leiste/i, 'groin'],
  [/achillessehne/i, 'Achilles tendon'],
  [/patellasehne/i, 'patellar tendon'],
  [
    /oberschenkel.*(anterior|ventral)|(anterior|ventral).*oberschenkel/i,
    'quadriceps',
  ],
  [
    /oberschenkel.*(posterior|dorsal)|(posterior|dorsal).*oberschenkel/i,
    'hamstring',
  ],
  [/\bwaden?\b/i, 'calf'],
  [/h(ue|ü)ftbeuger/i, 'iliopsoas'],
  [/adduktor/i, 'adductor'],
  [/syndesmose/i, 'syndesmotic ligament'],
  [/medial\w*\s+kollateralband/i, 'MCL'],
  [/lateral\w*\s+(kollateralband|bandruptur)/i, 'lateral ligament'],
  [/deltoid/i, 'deltoid ligament'],
  [/semime[nm]branosus/i, 'semimembranosus'],
  [/\blws\b|lendenwirbel/i, 'disc'],
  [/ges(ae|ä)(ss|ß)muskel/i, 'gluteus'],
  [/metacarpophalangeal|fingergelenk/i, 'joint capsule'],
  [/naviculare/i, 'metatarsal'],
  [/wirbel(?!s(ae|ä)ule)/i, 'disc'],
  [/\bzehs?\b|gro(ss|ß)en?\s+zeh/i, 'toe'],
  [/\bbecken\b/i, 'pelvis'],
]

/** Last N English tissue rules are generic region fallbacks — applied after German. */
const N_GENERIC_FALLBACKS = 11

export const TISSUE_TO_BODY_AREA: Record<string, string> = {
  'biceps femoris': 'hamstring',
  semitendinosus: 'hamstring',
  semimembranosus: 'hamstring',
  hamstring: 'hamstring',
  'rectus femoris': 'quadriceps',
  'vastus medialis': 'quadriceps',
  'vastus intermedius': 'quadriceps',
  'adductor longus': 'adductor',
  'adductor magnus': 'adductor',
  'adductor minimus': 'adductor',
  adductor: 'adductor',
  pectineus: 'adductor',
  'obturator internus': 'adductor',
  groin: 'adductor',
  iliopsoas: 'hip flexor',
  gastrocnemius: 'calf',
  soleus: 'calf',
  calf: 'calf',
  gluteus: 'glute',
  'rectus abdominis': 'abdomen',
  intercostal: 'thorax',
  anconeus: 'elbow',
  'flexor carpi': 'forearm',
  brachialis: 'arm',
  'Achilles tendon': 'Achilles',
  'biceps tendon': 'shoulder',
  'patellar tendon': 'knee',
  LCM: 'MCL',
  LTTA: 'ankle ligament',
  LFTA: 'ankle ligament',
  LFC: 'ankle ligament',
  'deltoid ligament': 'ankle ligament',
  'lateral ligament': 'ankle ligament',
  'syndesmotic ligament': 'syndesmosis',
  LUCL: 'elbow ligament',
  RCL: 'elbow ligament',
  metatarsal: 'foot',
  fibula: 'lower leg',
  tibia: 'lower leg',
  malleolus: 'ankle',
  'pubic bone': 'pelvis',
  'zygomatic arch': 'face',
  'femoral head': 'hip',
  humerus: 'arm',
  'radial head': 'elbow',
  toe: 'foot',
  disc: 'lumbar spine',
  labrum: 'shoulder',
  'AC joint': 'shoulder',
}

const SAP_INJURY_TYPE_VALUES = new Set([
  'Strain',
  'Muscle fiber tear',
  'Ligament rupture',
  'Sprain',
  'Overuse',
  'Contusion',
  'Fracture',
  'Muscle bundle tear',
])

const SAP_INJURY_TYPE_RULES: Rule[] = [
  [/\bfracture\b|\btransverse\s+process\b/i, 'Fracture'],
  [/\bmuscle\s+bundle\s+tear\b/i, 'Muscle bundle tear'],
  [
    /\bmuscle\s+fib(er|re)\s+tear|myofasc(ial|ia)\b|fascial\s+tear|muscle\s+injury\/strain/i,
    'Muscle fiber tear',
  ],
  [/\bligament\s+strain\b|\b\w+\s+ligament\s+strain\b/i, 'Strain'],
  [/\bmuscle\s+strain\b|\b\w+\s+strain\b/i, 'Strain'],
  [/\bstrain\b/i, 'Strain'],
  [/\bsprain\b/i, 'Sprain'],
  [/\bplantar\s+fascia\s+rupture\b/i, 'Ligament rupture'],
  [
    /\b(acl|pcl|mcl|lcl|ltta|lfta|lt4|syndesmo|deltoid|collateral)\b.*\b(rupture|tear|avulsion)\b/i,
    'Ligament rupture',
  ],
  [
    /\b(rupture|tear|avulsion)\b.*\b(acl|pcl|mcl|lcl|ligament|syndesmo)\b/i,
    'Ligament rupture',
  ],
  [/\bligament\s+rupture\b|\bmultiple\s+ankle\s+ligament/i, 'Ligament rupture'],
  [/\bmeniscus\b|\blabrum\b/i, 'Sprain'],
  [
    /\bcontusion\b|\bhematomas?\b|\blaceration\b|\bbruise\b|\bhemarthrosis\b|\bwhiplash\b|\beye\s+injury\b/i,
    'Contusion',
  ],
  [
    /\boveruse\b|\bosteoarthritis\b|\btendinopath\w*\b|\btendinitis\b|\benthesopath\w*\b|\bprolapse\b|\bdisc\b|\bthrombosis\b|\b(chronic|instability|irritat\w*|inflammation|arthrit\w*|lumbago)\b|\b(cramps?|trigger\s+points?)\b/i,
    'Overuse',
  ],
  [/\b(rupture|avulsion|subluxation|sublux)\b/i, 'Ligament rupture'],
  [/\btear\b/i, 'Sprain'],
  [/\bsoft\s+tissue\b/i, 'Contusion'],
]

const MECHANISM_TO_SAP_INJURY_TYPE: Record<string, string> = {
  fracture: 'Fracture',
  stress_fracture: 'Fracture',
  strain: 'Strain',
  sprain: 'Sprain',
  muscle_bundle_tear: 'Muscle bundle tear',
  muscle_fiber_tear: 'Muscle fiber tear',
  fascial_tear: 'Muscle fiber tear',
  muscle_injury: 'Muscle fiber tear',
  muscle_tendon_injury: 'Muscle fiber tear',
  contusion: 'Contusion',
  hemorrhage: 'Contusion',
  bone_bruise: 'Contusion',
  overuse: 'Overuse',
  inflammation: 'Overuse',
  acl_rupture: 'Ligament rupture',
  pcl_rupture: 'Ligament rupture',
  ligament_rupture: 'Ligament rupture',
  rupture: 'Ligament rupture',
  dislocation: 'Ligament rupture',
  avulsion: 'Ligament rupture',
}

function firstMatch(text: string, rules: Rule[]): string | null {
  for (const [pattern, label] of rules) {
    if (pattern.test(text)) return label
  }
  return null
}

export function joinInjuryText(
  ...parts: Array<string | null | undefined>
): string {
  return parts
    .map((part) => (part == null ? '' : String(part).trim()))
    .filter(Boolean)
    .join(' ')
}

export function extractMechanism(text: string): string {
  if (!text.trim()) return 'other'
  return firstMatch(text, INJURY_TYPE_RULES) ?? 'other'
}

/** Tissue from free text. Returns `"unknown"` when nothing matches — leave DB field empty. */
export function extractInjuryTissue(text: string): string {
  if (!text.trim()) return 'unknown'

  const specific = TISSUE_RULES.slice(0, -N_GENERIC_FALLBACKS)
  const generic = TISSUE_RULES.slice(-N_GENERIC_FALLBACKS)

  return (
    firstMatch(text, specific) ??
    firstMatch(text, GERMAN_TISSUE_RULES) ??
    firstMatch(text, generic) ??
    'unknown'
  )
}

export function tissueToBodyArea(tissue: string): string {
  return TISSUE_TO_BODY_AREA[tissue] ?? tissue
}

function buildInjuryLabel(location: string, mechanism: string): string {
  if (mechanism === 'ac_joint_separation') return 'AC joint separation'
  const display = MECH_DISPLAY[mechanism] ?? mechanism.replace(/_/g, ' ')
  if (!location || location === 'unknown') return display
  return `${location} ${display}`
}

/** Rehab workbook → `injuries.mechanism` (e.g. `"hamstring fiber tear"`). */
export function deriveRehabMechanism(text: string): string {
  const tissue = extractInjuryTissue(text)
  return buildInjuryLabel(tissueToBodyArea(tissue), extractMechanism(text))
}

/** Free text → coarse SAP InjuryTypeText vocabulary, or null. */
export function inferInjuryTypeText(text: string): string | null {
  if (!text.trim()) return null

  const fromRules = firstMatch(text, SAP_INJURY_TYPE_RULES)
  if (fromRules) return fromRules

  const mapped = MECHANISM_TO_SAP_INJURY_TYPE[extractMechanism(text)]
  return mapped && SAP_INJURY_TYPE_VALUES.has(mapped) ? mapped : null
}

/**
 * Backfill empty `mechanism` for rehab workbook rows (no SAP InjuryTypeText).
 * Returns null when undetermined — leave the field empty.
 */
export function deriveRehabMechanismOrNull(text: string): string | null {
  const label = deriveRehabMechanism(text)
  return label === 'injury' || label === 'other' ? null : label
}

/** Fill tissue only when empty; `"unknown"` → null. */
export function resolveTissue(
  existing: string | null | undefined,
  text: string
): string | null {
  if (existing?.trim()) return existing.trim()
  const tissue = extractInjuryTissue(text)
  return tissue === 'unknown' ? null : tissue
}

/** SAP ingestion: InjuryTypeText as-is, else infer from free text. */
export function resolveSapMechanism(
  injuryTypeText: string | null | undefined,
  text: string
): string | null {
  const fromSap = injuryTypeText?.trim()
  if (fromSap) return fromSap
  return inferInjuryTypeText(text)
}
