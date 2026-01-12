import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  type ChartOptions,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";
import dayjs from "dayjs";
import { useMemo, useState, useEffect } from "react";
import { Bar } from "react-chartjs-2";
import type { IPlayer } from "../../types/player.types";
import type { APIInjuryZone } from "../../types/injury.types";
import {
  INJURY_ZONES,
  MANNEQUIN_WRAPPER_CLASSES,
  EXERTION_COLOR,
  RESTING_COLOR,
} from "../../constants/injury.constants";
import BackBodySvg from "./back_body";
import FrontBodySvg from "./front_body";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { twMerge } from "tailwind-merge";
import type { APIDay } from "../../types/day.types";
import type { SupportedLanguage } from "../../utils/language_config";
import { getLocalizedName } from "../../utils/language_config";

ChartJS.register(BarElement, CategoryScale, LinearScale, Legend, Title, Tooltip);

interface Pain {
  dateOfDiscomfort: string;
  during: "always" | "activity" | "rest";
  levelOfPainToday: number;
  location: string;
}

interface IPhysicalPainsProps {
  discomforts: IPlayer["discomforts"];
  days: APIDay[];
}

export const PhysicalPains = ({ discomforts, days }: IPhysicalPainsProps) => {
  const { t, i18n } = useTranslation("player");
  const currentLanguage = i18n.language as SupportedLanguage;
  const [selectedInjuryZone, setSelectedBodyPart] = useState<Omit<
    IPlayer["discomforts"][number]["location"]["zone"],
    "id"
  > | null>(null);
  const [currentLocationIndex, setCurrentLocationIndex] = useState(0);

  const allPains = useMemo(() => {
    const processedPains = [
      // Process discomforts
      ...discomforts.map((discomfort) => ({
        dateOfDiscomfort: discomfort.dateOfDiscomfort || "",
        during:
          discomfort.during === "activity" || discomfort.during === "always"
            ? ("always" as const)
            : ("rest" as const),
        levelOfPainToday: discomfort.levelOfPainToday || 0,
        location: getLocalizedName(discomfort.location, currentLanguage),
        zone: {
          ...discomfort.location.zone,
          side: discomfort.location.zone.side as "front" | "back",
          name: discomfort.location.zone.name as APIInjuryZone,
        },
      })),
      // Process health pains
      ...days.flatMap((day) =>
        (day.health?.pains || []).map((pain) => ({
          dateOfDiscomfort: day.dateOfDay || "",
          during: "rest" as const,
          levelOfPainToday: pain.rating || 0,
          location: getLocalizedName(pain.location, currentLanguage),
          zone: {
            ...pain.location.zone,
            side: pain.location.zone.side as "front" | "back",
            name: pain.location.zone.name as APIInjuryZone,
          },
        })),
      ),
      // Process sport pains
      ...days.flatMap((day) =>
        (day.sportActivities || []).flatMap((activity) =>
          (activity.sportActivityPains || []).map((pain) => ({
            dateOfDiscomfort: day.dateOfDay || "",
            during: "activity" as const,
            levelOfPainToday: pain.rating || 0,
            location: getLocalizedName(pain.location, currentLanguage),
            zone: {
              ...pain.location.zone,
              side: pain.location.zone.side as "front" | "back",
              name: pain.location.zone.name as APIInjuryZone,
            },
          })),
        ),
      ),
    ];
    // Filter for valid zones and sides
    return processedPains.filter(
      (p) =>
        p.zone &&
        (p.zone.side === "front" || p.zone.side === "back") &&
        typeof p.zone.id === "number" &&
        typeof p.zone.name === "string" &&
        INJURY_ZONES.includes(p.zone.name as APIInjuryZone),
    );
  }, [discomforts, days, currentLanguage]);

  const locationGroups = useMemo(() => {
    if (!selectedInjuryZone) return [];
    const zonePains = allPains.filter(
      (pain) =>
        pain.zone.name === selectedInjuryZone?.name && pain.zone.side === selectedInjuryZone?.side,
    );

    const groups = new Map<string, Pain[]>();
    zonePains.forEach((pain) => {
      if (!groups.has(pain.location)) {
        groups.set(pain.location, []);
      }
      groups.get(pain.location)?.push(pain);
    });

    return Array.from(groups.entries());
  }, [selectedInjuryZone, allPains]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: useEffect lint problem
  useEffect(() => {
    setCurrentLocationIndex(0);
  }, [selectedInjuryZone]);

  const getGraphData = (locationDiscomforts: Pain[]) => {
    const labels = [
      ...new Set(
        locationDiscomforts
          .map((zone) => dayjs(zone.dateOfDiscomfort))
          .sort((a, b) => a.diff(b))
          .map((date) => date.format("DD/MM/YYYY")),
      ),
    ];

    const dateMap = new Map<string, { resting: number | null; exertion: number | null }>();

    labels.forEach((date) => {
      dateMap.set(date, { resting: null, exertion: null });
    });

    locationDiscomforts.forEach((injury) => {
      const date = dayjs(injury.dateOfDiscomfort).format("DD/MM/YYYY");
      const currentData = dateMap.get(date) || {
        resting: null,
        exertion: null,
      };

      if (injury.during === "rest") {
        const newRestingValue =
          currentData.resting === null
            ? injury.levelOfPainToday
            : Math.max(currentData.resting, injury.levelOfPainToday || 0);
        dateMap.set(date, { ...currentData, resting: newRestingValue });
      } else if (injury.during === "activity" || injury.during === "always") {
        const newExertionValue =
          currentData.exertion === null
            ? injury.levelOfPainToday
            : Math.max(currentData.exertion, injury.levelOfPainToday || 0);
        dateMap.set(date, { ...currentData, exertion: newExertionValue });
      }
    });

    const { restingData, exertionData } = {
      restingData: labels.map((date) => dateMap.get(date)?.resting || 0),
      exertionData: labels.map((date) => dateMap.get(date)?.exertion || 0),
    };

    const data = {
      labels,
      datasets: [
        {
          label: t("physicalPains.onExertion"),
          data: exertionData,
          backgroundColor: EXERTION_COLOR,
        },
        {
          label: t("physicalPains.resting"),
          data: restingData,
          backgroundColor: RESTING_COLOR,
        },
      ],
    };
    return data;
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: 12,
        right: 12,
        top: 8,
        bottom: 4,
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw;
            const label = context.dataset.label;
            return `${label}: ${value}/5`;
          },
        },
        backgroundColor: "#000000",
        titleFont: {
          family: "Poppins",
          size: 14,
        },
        bodyFont: {
          family: "Poppins",
          size: 12,
        },
        cornerRadius: 6,
        padding: 10,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 5,
        ticks: {
          font: {
            family: "Poppins",
            size: 12,
          },
          color: "#FFF",
        },
        grid: {
          display: false,
        },
        border: {
          color: "#FFFFFF",
        },
      },
      x: {
        ticks: {
          font: {
            family: "Poppins",
            size: 12,
          },
          color: "#FFF",
        },
        grid: {
          display: false,
        },
        border: {
          color: "#FFFFFF",
          display: true,
          width: 1,
        },
      },
    },
  };

  const handlePrevLocation = () => {
    setCurrentLocationIndex((prev) => (prev > 0 ? prev - 1 : locationGroups.length - 1));
  };

  const handleNextLocation = () => {
    setCurrentLocationIndex((prev) => (prev < locationGroups.length - 1 ? prev + 1 : 0));
  };

  const titleClasses =
    locationGroups.length > 1
      ? "text-sm mb-2 px-4 pt-4"
      : "text-base sm:text-lg mb-4 px-4 pt-6 pb-0";

  return (
    <div className="card w-full text-center flex flex-col gap-y-8 bg-[#252d3b] rounded-3xl">
      <p className="text-gray-100 font-medium text-xl">{t("physicalPains.title")}</p>
      <div className="flex flex-col gap-x-12 gap-y-8 px-4 sm:px-6 lg:px-8 2xl:flex-row 2xl:px-8">
        <div className="flex flex-row gap-x-3 sm:gap-x-4 md:gap-x-6 justify-center 2xl:justify-start flex-shrink-0 w-full sm:w-auto">
          <div className={MANNEQUIN_WRAPPER_CLASSES}>
            <FrontBodySvg pains={allPains} setSelectedInjuryZone={setSelectedBodyPart} />
          </div>
          <div className={MANNEQUIN_WRAPPER_CLASSES}>
            <BackBodySvg pains={allPains} setSelectedInjuryZone={setSelectedBodyPart} />
          </div>
        </div>
        {selectedInjuryZone && locationGroups.length > 0 ? (
          <div className="flex flex-col gap-y-8 flex-1 w-full max-w-full items-center justify-center">
            <div className="flex flex-col items-center gap-y-4 w-full max-w-full">
              <div className="flex items-center gap-x-4 w-full max-w-full justify-center">
                {locationGroups[currentLocationIndex] && (
                  <div className="card flex flex-col flex-1 min-w-0 h-[300px] w-full 2xl:max-w-[85%] px-2 sm:px-4">
                    <p className={twMerge("font-medium text-gray-100 truncate", titleClasses)}>
                      {locationGroups[currentLocationIndex][0]}
                    </p>
                    <div
                      className={twMerge(
                        "mx-auto flex items-center justify-center overflow-hidden flex-1 w-full px-2",
                        locationGroups.length > 1 ? "h-24" : "h-32 sm:h-40",
                      )}
                    >
                      <div className="w-full h-full">
                        <Bar
                          data={getGraphData(locationGroups[currentLocationIndex][1])}
                          options={options}
                        />
                      </div>
                    </div>
                    <div
                      className={twMerge(
                        "flex justify-center flex-shrink-0 px-4",
                        locationGroups.length > 1 ? "gap-x-4 mt-2 mb-2" : "gap-x-6 mt-4 mb-4",
                      )}
                    >
                      <div className="flex items-center gap-x-1.5">
                        <div className="w-3 h-3" style={{ backgroundColor: EXERTION_COLOR }} />
                        <span className="text-[10px] leading-tight">Exertion</span>
                      </div>
                      <div className="flex items-center gap-x-1.5">
                        <div className="w-3 h-3" style={{ backgroundColor: RESTING_COLOR }} />
                        <span className="text-[10px] leading-tight">Resting</span>
                      </div>
                    </div>
                    {locationGroups.length > 1 && (
                      <div className="flex items-center gap-x-2 justify-center mb-4 flex-shrink-0">
                        <button
                          onClick={handlePrevLocation}
                          className="p-1.5 rounded-full hover:bg-gray-700 transition-colors flex-shrink-0"
                          type="button"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <p className="text-xs text-gray-400">
                          {currentLocationIndex + 1} {t("physicalPains.of")} {locationGroups.length}
                        </p>
                        <button
                          onClick={handleNextLocation}
                          className="p-1.5 rounded-full hover:bg-gray-700 transition-colors flex-shrink-0"
                          type="button"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-y-8 flex-1 items-center justify-center">
            <p className="text-gray-400 text-lg">{t("physicalPains.hoverOverLocation")}</p>
          </div>
        )}
      </div>
    </div>
  );
};
