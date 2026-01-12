import type { APIInjuryZone } from "../types/injury.types";

export const INJURY_ZONES: APIInjuryZone[] = [
  "head",
  "zone_1",
  "zone_1a",
  "zone_1b",
  "zone_2",
  "zone_2a",
  "zone_2b",
  "zone_3",
  "zone_3a",
  "zone_3b",
  "zone_4",
  "zone_4a",
  "zone_4b",
  "zone_5a",
  "zone_5b",
  "zone_6a",
  "zone_6b",
];

export const mapFrontInjuryZonesToLabel: Partial<Record<APIInjuryZone, string>> = {
  head: "Head",
  zone_1: "Neck",
  zone_1a: "Right Hip - Groin - Pubis - Thigh",
  zone_1b: "Left Hip - Groin - Pubis - Thigh",
  zone_2: "Chest - Thorax",
  zone_2a: "Left Knee - Patella",
  zone_2b: "Right Knee - Patella",
  zone_3a: "Right Shoulder - Clavicles",
  zone_3b: "Left Shoulder - Clavicles",
  zone_4: "Abdominals",
  zone_4a: "Right Ankle - Arch - Toes",
  zone_4b: "Left Ankle - Arch - Toes",
  zone_5a: "Right Bicep - Forearm - Wrist",
  zone_5b: "Left Bicep - Forearm - Wrist",
  zone_6a: "Right Shin - Thight - Fibula",
  zone_6b: "Left Shin - Thight - Fibula",
} as const;

export const mapBackInjuryZonesToLabel: Partial<Record<APIInjuryZone, string>> = {
  head: "Head",
  zone_1: "Cervical - Trapezius",
  zone_1b: "Left Buttock - Hamstring",
  zone_1a: "Right Buttock - Hamstring",
  zone_2: "Back",
  zone_2b: "Left Calf",
  zone_2a: "Right Calf",
  zone_3: "Lumbar",
  zone_3a: "Right Heel",
  zone_3b: "Left Heel",
  zone_4a: "Right Tricep - Elbow - Hand",
  zone_4b: "Left Tricep - Elbow - Hand",
} as const;

export const MANNEQUIN_WRAPPER_CLASSES = "w-fit h-fit flex-shrink-0";

export const EXERTION_COLOR = "rgba(49, 140, 181, 1)";

export const RESTING_COLOR = "rgba(172, 226, 249, 1)";
