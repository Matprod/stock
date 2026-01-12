import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SupportedLanguage } from "../../utils/language_config";
import { getLocalizedName } from "../../utils/language_config";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";

import type { IPlayer, APIInjury } from "../../types/player.types";
import type { APIInjuryZone } from "../../types/injury.types";
import { INJURY_ZONES, MANNEQUIN_WRAPPER_CLASSES } from "../../constants/injury.constants";
import BackBodySvg from "./back_body";
import FrontBodySvg from "./front_body";

ChartJS.register(BarElement, CategoryScale, LinearScale, Legend, Title, Tooltip);

interface IInjuryHistoryProps {
  injuries: APIInjury[];
}

export const InjuryHistory = ({ injuries }: IInjuryHistoryProps) => {
  const { t, i18n } = useTranslation("player");
  const currentLanguage = i18n.language as SupportedLanguage;

  const [selectedInjuryZone, setSelectedBodyPart] = useState<Omit<
    IPlayer["discomforts"][number]["location"]["zone"],
    "id"
  > | null>(null);
  const [currentLocationIndex, setCurrentLocationIndex] = useState(0);
  const getDaysSinceInjury = (injuryDate: string, recoveryDate?: string): string => {
    const start = dayjs(injuryDate);
    const end = recoveryDate ? dayjs(recoveryDate) : dayjs();
    const days = end.diff(start, "day");
    if (days === 0) return t("injuryHistory.days.today");
    if (days === 1) return t("injuryHistory.days.one", { count: days });
    return t("injuryHistory.days.other", { count: days });
  };

  const allInjuries = useMemo(() => {
    return injuries
      .map((injury) => ({
        dateOfInjury: injury.dateOfInjury || "",
        recoveryDate: injury.recoveryDate,
        injuryType: getLocalizedName(injury.injuryType, currentLanguage),
        location: getLocalizedName(injury.injuryType.category, currentLanguage),
        zone: {
          ...injury.injuryType.category.zone,
          side: injury.injuryType.category.zone.side as "front" | "back",
          name: injury.injuryType.category.zone.name as APIInjuryZone,
        },
      }))
      .filter(
        (injury) =>
          injury.zone &&
          (injury.zone.side === "front" || injury.zone.side === "back") &&
          typeof injury.zone.id === "number" &&
          typeof injury.zone.name === "string" &&
          INJURY_ZONES.includes(injury.zone.name as APIInjuryZone),
      );
  }, [injuries, currentLanguage]);

  const painsForSvg = useMemo(() => {
    return allInjuries.map((injury) => ({
      dateOfDiscomfort: injury.dateOfInjury,
      during: "rest" as const,
      levelOfPainToday: injury.recoveryDate ? 3 : 5,
      location: injury.location,
      zone: injury.zone,
    }));
  }, [allInjuries]);

  const locationGroups = useMemo(() => {
    if (!selectedInjuryZone) return [];
    const zoneInjuries = allInjuries.filter(
      (injury) =>
        injury.zone.name === selectedInjuryZone?.name &&
        injury.zone.side === selectedInjuryZone?.side,
    );

    const groups = new Map<string, Array<(typeof allInjuries)[number]>>();
    zoneInjuries.forEach((injury) => {
      if (!groups.has(injury.location)) {
        groups.set(injury.location, []);
      }
      groups.get(injury.location)?.push(injury);
    });

    return Array.from(groups.entries());
  }, [selectedInjuryZone, allInjuries]);

  useEffect(() => {
    if (selectedInjuryZone) {
      setCurrentLocationIndex(0);
    }
  }, [selectedInjuryZone]);

  const handlePrevLocation = () => {
    setCurrentLocationIndex((prev) => (prev > 0 ? prev - 1 : locationGroups.length - 1));
  };

  const handleNextLocation = () => {
    setCurrentLocationIndex((prev) => (prev < locationGroups.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="card w-full text-center flex flex-col gap-y-8 bg-[#252d3b] rounded-3xl">
      <p className="text-gray-100 font-medium text-xl">{t("injuryHistory.title")}</p>
      <div className="flex flex-col gap-x-12 gap-y-8 px-4 sm:px-6 lg:px-8 2xl:flex-row 2xl:px-8">
        <div className="flex flex-row gap-x-3 sm:gap-x-4 md:gap-x-6 justify-center 2xl:justify-start flex-shrink-0 w-full sm:w-auto">
          <div className={MANNEQUIN_WRAPPER_CLASSES}>
            <FrontBodySvg
              pains={painsForSvg}
              setSelectedInjuryZone={setSelectedBodyPart}
              displayType="injuryHistory"
            />
          </div>
          <div className={MANNEQUIN_WRAPPER_CLASSES}>
            <BackBodySvg
              pains={painsForSvg}
              setSelectedInjuryZone={setSelectedBodyPart}
              displayType="injuryHistory"
            />
          </div>
        </div>
        {selectedInjuryZone && locationGroups.length > 0 ? (
          <div className="flex flex-col gap-y-8 flex-1 w-full max-w-full items-center justify-center">
            <div className="flex flex-col items-center gap-y-4 w-full max-w-full">
              <div className="flex items-center gap-x-4 w-full max-w-full justify-center">
                {locationGroups.length > 1 && (
                  <button
                    onClick={handlePrevLocation}
                    className="p-2 rounded-full hover:bg-gray-700 transition-colors flex-shrink-0"
                    type="button"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}
                {locationGroups[currentLocationIndex] && (
                  <div className="card p-6 flex flex-col flex-1 min-w-0 min-h-[300px] w-full 2xl:max-w-[85%]">
                    <p className="text-lg font-medium mb-4 text-gray-100 truncate">
                      {locationGroups[currentLocationIndex][0] || "No injury name"}
                    </p>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 max-h-40 min-[1600px]:max-h-44 w-full mx-auto">
                      {locationGroups[currentLocationIndex][1].map((injury, index) => (
                        <div
                          key={`${injury.dateOfInjury}-${injury.injuryType}-${injury.recoveryDate || "ongoing"}-${index}`}
                          className="bg-gray-800 p-3 rounded-lg"
                        >
                          <div className="text-center mb-3">
                            <p className="text-base font-medium text-gray-100 break-words">
                              {injury.injuryType}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs text-gray-400 break-words">
                              {t("injuryHistory.start")}:{" "}
                              {dayjs(injury.dateOfInjury).format("DD/MM/YYYY")} (
                              {getDaysSinceInjury(injury.dateOfInjury, injury.recoveryDate)})
                            </p>
                            {injury.recoveryDate ? (
                              <p className="text-xs text-[rgba(172,226,249,1)] break-words">
                                {t("injuryHistory.end")}:{" "}
                                {dayjs(injury.recoveryDate).format("DD/MM/YYYY")}
                              </p>
                            ) : (
                              <p className="text-xs text-[rgba(49,140,181,1)] break-words">
                                {t("injuryHistory.status")}: {t("injuryHistory.ongoing")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {locationGroups.length > 1 && (
                  <button
                    onClick={handleNextLocation}
                    className="p-2 rounded-full hover:bg-gray-700 transition-colors flex-shrink-0"
                    type="button"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </div>
              {locationGroups.length > 1 && locationGroups[currentLocationIndex] && (
                <p className="text-sm text-gray-400">
                  {currentLocationIndex + 1} {t("injuryHistory.of")} {locationGroups.length}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-y-8 flex-1 items-center justify-center">
            <p className="text-gray-400 text-lg">{t("injuryHistory.hoverOverLocation")}</p>
          </div>
        )}
      </div>
    </div>
  );
};
