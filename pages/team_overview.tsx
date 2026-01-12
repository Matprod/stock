import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useMemo } from "react";
import { PlayerCard } from "../components/player/player_card";
import { Skeleton } from "../components/ui/skeleton";
import type { ITeamOverviewPlayer } from "../types/player.types";
import { isPlayerInjured } from "../utils/is_player_injured";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { ToggleSwitch } from "../components/ui/toggle_switch"; // Assure-toi d'avoir créé ce fichier (voir étape précédente)
import { Label } from "../components/ui/label"; // Assure-toi d'avoir créé ce fichier (voir étape précédente)
import useGetAthletes from "../lib/query/athletes/get_athletes";
import { useDemoStore } from "../store/demo-store";
import LottieOrig from "lottie-react";
const Lottie: any = LottieOrig;
import restingAnimation from "../assets/resting.json";
import { useDateStore } from "../store/date-store";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from "lucide-react";
import { useSeasonStore } from "../store/season-store";
import useGetSeasons from "../lib/query/seasons/get_seasons";
import { getCurrentSeason } from "../utils/get_current_season";

type SortOption =
  | "performance-asc"
  | "performance-desc"
  | "injury-asc"
  | "injury-desc"
  | "injured-only";

const TeamOverview = () => {
  const [sortOption, setSortOption] = useState<SortOption>("performance-asc");
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [isTodayMode, setIsTodayMode] = useState(true); // Remplace "todayOnly" pour le contrôle UI

  const { t } = useTranslation("team_overview");
  const { data: teamData, isLoading: isAthletesLoading } = useGetAthletes();
  const { data: seasons, isLoading: isSeasonsLoading } = useGetSeasons();
  const { selectedSeasonId } = useSeasonStore();
  const { setAthleteDate } = useDateStore();
  const { isDemo } = useDemoStore(); // Au cas où tu veux filtrer en mode démo

  const isLoading = isAthletesLoading || isSeasonsLoading;

  // --- 1. Initialisation de la Date (Logique Saisons) ---
  useEffect(() => {
    if (!seasons) return;

    // Si le mode "Aujourd'hui" est actif, on force la date du jour
    if (isTodayMode) {
      setCurrentDate(dayjs());
      return;
    }

    const activeSeason = selectedSeasonId
      ? seasons.find((s) => s.id === selectedSeasonId)
      : getCurrentSeason(seasons, true);

    if (activeSeason) {
      const seasonEnd = dayjs(activeSeason.endDate);
      const now = dayjs();

      // Si la saison est terminée (passée), on initialise le calendrier à la fin de la saison
      if (now.isAfter(seasonEnd)) {
        setCurrentDate(seasonEnd);
      } else {
        // Sinon, logique standard (aujourd'hui, ou début de saison si futur)
        const seasonStart = dayjs(activeSeason.startDate);
        if (now.isBefore(seasonStart)) {
          setCurrentDate(seasonStart);
        } else {
          setCurrentDate(now);
        }
      }
    }
  }, [selectedSeasonId, seasons, isTodayMode]);

  // --- Handlers ---
  const handleDateChange = (direction: "prev" | "next") => {
    setIsTodayMode(false); // Désactive le mode "Today" si on navigue manuellement
    setCurrentDate((prev) =>
      direction === "prev" ? prev.subtract(1, "day") : prev.add(1, "day")
    );
  };

  const handleTodayToggle = (checked: boolean) => {
    setIsTodayMode(checked);
    if (checked) {
      setCurrentDate(dayjs());
    }
  };

  // --- 2. Logique de Tri et Filtrage (Le Cœur du sujet) ---
  const getSortedAndFilteredPlayers = () => {
    return (teamData ?? [])
      .map((player) => {
        // 1. On cherche les données EXACTES pour la date sélectionnée (currentDate)
        const dayData = player.days.find((day) =>
          dayjs(day.dateOfDay).isSame(currentDate, "day")
        );

        // Filtre : Blessés uniquement
        if (
          sortOption === "injured-only" &&
          !isPlayerInjured(player.injuries, currentDate)
        ) {
          return null;
        }

        // Si pas de données et on est en mode Demo stricte (optionnel selon tes besoins)
        if (!dayData && isDemo) {
          // return null; // Décommenter si tu veux cacher les joueurs sans données en démo
        }

        const hasPerformance =
          dayData?.finalScore !== null && dayData?.finalScore !== undefined;
        const hasInjury =
          dayData?.injuryScore !== null && dayData?.injuryScore !== undefined;

        return {
          player,
          performanceScore: hasPerformance
            ? Math.round(dayData!.finalScore!)
            : null,
          injuryScore: hasInjury ? Math.round(dayData!.injuryScore!) : null,
          hasPerformance,
          hasInjury,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        // --- NIVEAU 1 : Priorité par Tiers (Groupes) ---
        // Tier 2 : A les deux scores (Perf + Injury)
        // Tier 1 : A un seul score
        // Tier 0 : N'a aucun score
        const getTierScore = (item: typeof a) => {
          let score = 0;
          if (item.hasPerformance) score++;
          if (item.hasInjury) score++;
          return score;
        };

        const tierA = getTierScore(a);
        const tierB = getTierScore(b);

        // Si les tiers sont différents, on affiche le meilleur tier en premier
        if (tierA !== tierB) {
          return tierB - tierA;
        }

        // --- NIVEAU 2 : Tri Secondaire (Option choisie) ---
        // Helper : Valeur par défaut pour le tri (les nulls vont à la fin)
        const getValAsc = (val: number | null) => (val === null ? 9999 : val);
        const getValDesc = (val: number | null) => (val === null ? -9999 : val);

        switch (sortOption) {
          case "performance-asc":
            return (
              getValAsc(a.performanceScore) - getValAsc(b.performanceScore)
            );
          case "performance-desc":
            return (
              getValDesc(b.performanceScore) - getValDesc(a.performanceScore)
            );
          case "injury-asc":
            return getValAsc(a.injuryScore) - getValAsc(b.injuryScore);
          case "injury-desc":
            return getValDesc(b.injuryScore) - getValDesc(a.injuryScore);
          default:
            return (
              getValDesc(b.performanceScore) - getValDesc(a.performanceScore)
            );
        }
      });
  };

  const players = useMemo(
    () => getSortedAndFilteredPlayers(),
    [teamData, currentDate, sortOption, isDemo]
  );
  const hasDataForDate = players.some((p) => p.hasPerformance || p.hasInjury);

  // --- Affichage Loading (avec padding pour le header fixe) ---
  if (isLoading) {
    return (
      <div className="pt-32 px-4 max-w-7xl mx-auto">
        <h1 className="text-white-400 font-medium text-4xl text-center mb-7">
          {t("title")}
        </h1>
        <div className="flex flex-col gap-y-6 w-full">
          {[...Array(5)].map((_, index) => (
            <div
              key={index}
              className="bg-white/15 border border-[#ffffff1a] rounded-lg py-4 px-10 flex flex-row items-center justify-between"
            >
              <div className="flex flex-row items-center gap-x-20">
                <Skeleton className="w-[90px] h-[90px] rounded-full bg-gray-700/50" />
                <div className="space-y-2">
                  <Skeleton className="h-8 w-[200px] bg-gray-700/50" />
                  <Skeleton className="h-6 w-[150px] bg-gray-700/50" />
                </div>
              </div>
              <Skeleton className="w-6 h-6 ml-4 bg-gray-700/50" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* --- BANNIÈRE FIXE (HEADER) --- */}
      <div className="fixed top-0 left-0 w-full z-40 bg-[#1E2638]/95 border-b border-white/10 shadow-lg backdrop-blur-sm transition-all">
        <div className="max-w-7xl mx-auto px-6 py-4 md:pl-24 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Titre */}
          <h1 className="font-medium text-2xl text-white-400 whitespace-nowrap">
            {t("title")}
          </h1>

          {/* Calendrier Central */}
          <div className="flex items-center gap-4">
            {/* Désactive visuellement le calendrier si le mode "Today" est forcé */}
            <div
              className={`flex items-center justify-center gap-4 bg-white/5 rounded-full px-6 py-2 border border-white/10 shadow-inner transition-opacity ${
                isTodayMode ? "opacity-50 pointer-events-none" : "opacity-100"
              }`}
            >
              <button
                onClick={() => handleDateChange("prev")}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-blue-100 hover:text-white"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="flex items-center gap-3 min-w-[160px] justify-center text-blue-50 font-medium select-none">
                <CalendarIcon size={16} className="text-blue-300/80" />
                <span className="tabular-nums uppercase tracking-wide text-sm">
                  {currentDate.format("DD MMM YYYY")}
                </span>
              </div>

              <button
                onClick={() => handleDateChange("next")}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-blue-100 hover:text-white"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Contrôles de droite (Switch + Select) */}
          <div className="flex gap-6 items-center">
            {/* Toggle "Today's Data" */}
            <div className="flex items-center gap-x-3">
              <ToggleSwitch
                id="today-mode"
                checked={isTodayMode}
                onChange={handleTodayToggle}
              />
            </div>

            {/* Select Sort */}
            <Select
              value={sortOption}
              onValueChange={(value: SortOption) => setSortOption(value)}
            >
              <SelectTrigger className="w-[200px] bg-white/5 border-white/10 text-blue-100 focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder={t("sortOptions.placeholder")} />
              </SelectTrigger>
              <SelectContent className="bg-[#1E2638] border-white/10 text-blue-100">
                <SelectItem value="performance-asc">
                  {t("sortOptions.performance-asc")}
                </SelectItem>
                <SelectItem value="performance-desc">
                  {t("sortOptions.performance-desc")}
                </SelectItem>
                <SelectItem value="injury-asc">
                  {t("sortOptions.injury-asc")}
                </SelectItem>
                <SelectItem value="injury-desc">
                  {t("sortOptions.injury-desc")}
                </SelectItem>
                <SelectItem value="injured-only">
                  {t("sortOptions.injured-only")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* --- LISTE DES JOUEURS (Main Content) --- */}
      {/* pt-32 pour compenser le header fixe */}
      <div className="pt-32 px-4 max-w-7xl mx-auto flex flex-col gap-y-6 w-full pb-10">
        {players.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 min-h-[50vh]">
            <Lottie
              animationData={restingAnimation}
              loop
              style={{ width: 300, height: 300 }}
            />
            <div className="text-center text-blue-200/60 mt-4 text-lg font-medium">
              {t("noData.noDataToday")}
            </div>
          </div>
        ) : (
          <>
            {/* Feedback si aucune donnée pour la date choisie (mais joueurs présents) */}
            {!hasDataForDate && (
              <div className="w-full text-center py-2 text-blue-200/40 text-sm italic border border-dashed border-white/10 rounded-lg">
                No performance data recorded for{" "}
                {currentDate.format("MMMM D, YYYY")}
              </div>
            )}

            {players.map(({ player }, index) => (
              <PlayerCard
                key={player.id || index}
                player={player}
                date={currentDate}
                // IMPORTANT : On passe la date sélectionnée à la carte pour l'affichage cohérent
                selectedDate={currentDate}
                onClick={() => {
                  setAthleteDate(currentDate.format("YYYY-MM-DD"));
                }}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
};

export default TeamOverview;
