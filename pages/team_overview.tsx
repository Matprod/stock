import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { useState } from "react";
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
import useGetAthletes from "../lib/query/athletes/get_athletes";
import { useDemoStore } from "../store/demo-store";
import { ToggleSwitch } from "../components/ui/toggle_switch";
import LottieOrig from "lottie-react";
const Lottie: any = LottieOrig;
import restingAnimation from "../assets/resting.json";
import playingAnimation from "../assets/playing.json";
import { useDateStore } from "../store/date-store";

type SortOption =
  | "performance-asc"
  | "performance-desc"
  | "injury-asc"
  | "injury-desc"
  | "today-only"
  | "injured-only";

const TeamOverview = () => {
  const [sortOption, setSortOption] = useState<SortOption>("performance-asc");
  const [todayOnly, setTodayOnly] = useState(false);
  const { t } = useTranslation("team_overview");
  const { data: teamData, isLoading } = useGetAthletes();
  const { isDemo } = useDemoStore();
  const { setAthleteDate } = useDateStore();

  const getSortedAndFilteredPlayers = () => {
    return (teamData ?? [])
      .map((player) => {
        const latestDay = player.days
          .filter((day) => !!day.finalScore)
          .filter((day) => dayjs(day.dateOfDay).isBefore(dayjs(), "day"))
          .sort(
            (a, b) =>
              new Date(b.dateOfDay).getTime() - new Date(a.dateOfDay).getTime()
          )[0];

        if (
          sortOption === "injured-only" &&
          !isPlayerInjured(player.injuries, dayjs())
        ) {
          return null;
        }
        if (!latestDay) {
          if (isDemo) {
            return null;
          }
          if (todayOnly) {
            return null;
          }
          return {
            player,
            performanceScore: null,
            injuryScore: null,
          };
        }
        if (
          todayOnly &&
          !(
            dayjs(latestDay.dateOfDay).isSame(dayjs(), "day") ||
            dayjs(latestDay.dateOfDay).isSame(dayjs().subtract(1, "day"), "day")
          )
        ) {
          return null;
        }

        return {
          player,
          performanceScore: latestDay.finalScore
            ? Math.round(latestDay.finalScore)
            : null,
          injuryScore: latestDay.injuryScore
            ? Math.round(latestDay.injuryScore)
            : null,
        };
      })
      .filter(
        (
          item
        ): item is {
          player: ITeamOverviewPlayer;
          performanceScore: number;
          injuryScore: number;
        } => item !== null
      )
      .sort((a, b) => {
        switch (sortOption) {
          case "performance-asc":
            return a.performanceScore - b.performanceScore;
          case "performance-desc":
            return b.performanceScore - a.performanceScore;
          case "injury-asc":
            return a.injuryScore - b.injuryScore;
          case "injury-desc":
            return b.injuryScore - a.injuryScore;
          default:
            return a.performanceScore - b.performanceScore;
        }
      });
  };

  if (isLoading) {
    return (
      <>
        <h1 className="text-white-400 font-medium text-4xl text-center mb-7">
          {t("title")}
        </h1>
        <div className="flex justify-end mb-6">
          <div className="bg-white/10 rounded-2xl p-2">
            <Skeleton className="w-[200px] h-10 bg-gray-700/50 rounded-lg" />
          </div>
        </div>
        <div className="flex flex-col gap-y-6 w-full">
          {[...Array(5)].map((_, index) => (
            <div
              key={index}
              className="bg-white/15 border border-[#ffffff1a] rounded-lg py-4 px-10 flex flex-row items-center justify-between"
            >
              <div className="flex flex-row items-center gap-x-20">
                <div className="relative w-[90px] h-[90px] flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gray-700/50 animate-pulse">
                    <div className="w-full h-full bg-gray-800 rounded-full flex items-center justify-center">
                      <Skeleton className="w-full h-full rounded-full" />
                    </div>
                  </div>
                </div>
                <div className="text-lg">
                  <Skeleton className="h-8 w-[200px] bg-gray-700/50 mb-2" />
                  <Skeleton className="h-6 w-[150px] bg-gray-700/50 mb-2" />
                  <Skeleton className="h-4 w-[100px] bg-gray-700/50" />
                </div>
              </div>
              <Skeleton className="w-6 h-6 ml-4 bg-gray-700/50" />
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="font-medium text-4xl text-center text-white-400 mb-7">
        {t("title")}
      </h1>
      <div className="flex justify-end mb-6 gap-4 items-center">
        <ToggleSwitch
          checked={todayOnly}
          onChange={setTodayOnly}
          label={t("sortOptions.today-only")}
          className="rounded-2xl p-4"
        />
        <div>
          <Select
            value={sortOption}
            onValueChange={(value: SortOption) => setSortOption(value)}
          >
            <SelectTrigger className="w-[200px] rounded-ml">
              <SelectValue placeholder={t("sortOptions.placeholder")} />
            </SelectTrigger>
            <SelectContent>
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
      <div className="flex flex-col gap-y-6 w-full">
        {(() => {
          const players = getSortedAndFilteredPlayers();
          if (players.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center py-8">
                {todayOnly && (
                  <>
                    <Lottie
                      animationData={restingAnimation}
                      loop
                      style={{ width: 300, height: 300 }}
                    />
                    <div className="text-center text-blue-100 mt-4 text-lg font-medium">
                      {t("noData.noDataToday")}
                    </div>
                  </>
                )}
                {sortOption === "injured-only" && !todayOnly && (
                  <>
                    <Lottie
                      animationData={playingAnimation}
                      loop
                      style={{ width: 300, height: 300 }}
                    />
                    <div className="text-center text-blue-100 mt-4 text-lg font-medium">
                      {t("noData.allPlayersFit")}
                    </div>
                  </>
                )}
              </div>
            );
          }
          return players.map(({ player }, index) => (
            <PlayerCard
              key={index}
              player={player}
              onClick={() => {
                const latestDay = player.days
                  .filter(
                    (day) =>
                      day.finalScore !== undefined && day.finalScore !== null
                  )
                  .filter((day) =>
                    dayjs(day.dateOfDay).isBefore(dayjs(), "day")
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.dateOfDay).getTime() -
                      new Date(a.dateOfDay).getTime()
                  )[0];
                setAthleteDate(
                  latestDay?.dateOfDay ?? dayjs().format("YYYY-MM-DD")
                );
              }}
            />
          ));
        })()}
      </div>
    </>
  );
};

export default TeamOverview;
