import type { Dispatch, ReactNode, SetStateAction } from "react";
import { twMerge } from "tailwind-merge";
import type { APIInjuryZone, Pain } from "../../types/injury.types";
import { getInjuryColor, getMaxPainLevel, type MannequinDisplayType } from "../../utils/injury";

interface IBodyPartProps {
  children: ReactNode;
  discomforts?: Pain[];
  injuryZone: APIInjuryZone;
  side: "front" | "back";
  setSelectedInjuryZone: Dispatch<
    SetStateAction<{ name: APIInjuryZone; side: "front" | "back" } | null>
  >;
  displayType?: MannequinDisplayType;
}

export const BodyPart = ({
  children,
  discomforts,
  injuryZone,
  side,
  setSelectedInjuryZone,
  displayType = "physicalPains",
}: IBodyPartProps) => {
  const maxPainLevel = getMaxPainLevel(injuryZone, side, discomforts);
  const injuryColor = getInjuryColor(maxPainLevel, displayType);
  return (
    <g
      className={twMerge("opacity-60", injuryColor)}
      onMouseEnter={() => {
        if (maxPainLevel > 0) setSelectedInjuryZone({ name: injuryZone, side });
      }}
    >
      {children}
    </g>
  );
};
