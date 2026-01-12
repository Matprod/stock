import type { APIInjuryZone, Pain, MannequinDisplayType } from "../types/injury.types";
export type { MannequinDisplayType };

export const getInjuryColor = (
  painLevel: number,
  displayType: MannequinDisplayType = "physicalPains",
) => {
  if (displayType === "injuryHistory") {
    switch (painLevel) {
      case 3:
        return "fill-[rgba(172,226,249,1)]";
      case 5:
        return "fill-[rgba(49,140,181,1)]";
      default:
        return "fill-white";
    }
  }

  switch (painLevel) {
    case 1:
      return "fill-red-200";
    case 2:
      return "fill-red-300";
    case 3:
      return "fill-red-400";
    case 4:
      return "fill-red-500";
    case 5:
      return "fill-red-600";
    default:
      return "fill-white";
  }
};

export const getMaxPainLevel = (zone: APIInjuryZone, side: "front" | "back", pains?: Pain[]) => {
  if (!pains) return 0;
  const zonePains = pains.filter((pain) => pain.zone.name === zone && pain.zone.side === side);
  if (zonePains.length === 0) return 0;

  return Math.max(...zonePains.map((pain) => pain.levelOfPainToday));
};
