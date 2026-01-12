import { ChevronRightIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { ITeamOverviewPlayer } from "../../types/player.types";
import type { IFile } from "../../types/file.type";
import { isPlayerInjured } from "../../utils/is_player_injured";
import dayjs from "dayjs";
import CircularProgress from "../ui/circular_progress";
import { useTranslation } from "react-i18next";
import { getCircularProgressColor } from "../../utils/circular_progress";
import { formatFileToUrl } from "../../utils/formatFileToUrl";
import useGetSeasons from "../../lib/query/seasons/get_seasons";
import { useSeasonStore } from "../../store/season-store";
import { useMemo } from "react";
// import { getCircularProgressColor } from "../../utils/circular_progress";

export interface IPlayerCardProps {
  player: ITeamOverviewPlayer;
  onClick?: () => void;
}

export const PlayerCard = ({ player, onClick }: IPlayerCardProps) => {
  const { t } = useTranslation("player");
  const { data: seasons } = useGetSeasons();
  const { selectedSeasonId } = useSeasonStore();
  const currentSeasonLatestDay = useMemo(() => {
    const currentSeason = seasons?.find((season) => season.id === selectedSeasonId);
    if (!currentSeason) return dayjs();

    const seasonEndDate = dayjs(currentSeason.endDate);
    if (seasonEndDate.isAfter(dayjs())) {
      return dayjs();
    }
    return seasonEndDate;
  }, [seasons?.find, selectedSeasonId]);
  const isInjured = isPlayerInjured(player.injuries, currentSeasonLatestDay);
  const latestDay = player.days
    .filter((day) => day.finalScore !== undefined && day.finalScore !== null)
    .filter((day) => dayjs(day.dateOfDay).isBefore(dayjs(), "day"))
    .sort((a, b) => new Date(b.dateOfDay).getTime() - new Date(a.dateOfDay).getTime())[0];

  const performanceScore = latestDay?.finalScore;
  const injuryScore = latestDay?.injuryScore === 0 ? 1 : latestDay?.injuryScore;

  const numOfDaysAgo = latestDay
    ? dayjs().subtract(1, "day").diff(dayjs(latestDay.dateOfDay), "day")
    : null;
  const lastUpdateDate = latestDay ? dayjs(latestDay.dateOfDay).format("DD/MM/YYYY") : null;

  const isLatestSeason = useMemo(() => {
    if (!seasons || seasons.length === 0) return false;
    return (
      selectedSeasonId === seasons.sort((a, b) => dayjs(b.startDate).diff(dayjs(a.startDate)))[0].id
    );
  }, [selectedSeasonId, seasons]);

  // const getPerformanceColor = (score: number) => {
  //   if (score >= 70) return "stroke-orange-500";
  //   if (score >= 40) return "stroke-orange-400";
  //   return "stroke-red-400";
  // };

  // const getInjuryColor = (score: number) => {
  //   if (score >= 70) return "stroke-rose-500";
  //   if (score >= 40) return "stroke-amber-500";
  //   return "stroke-emerald-500";
  // };

  return (
    <Link
      to={`/player/${player.id}`}
      className="bg-[#2a3347] hover:bg-[#323d56] border border-[#3a4561] rounded-3xl py-4 px-10 flex flex-row items-center justify-between transition-colors duration-200"
      onClick={onClick}
    >
      <div className="flex flex-row items-center gap-x-10">
        <PlayerPicture url={getPlayerPicture(player)} name={player.name} />
        <div className="text-lg">
          {isInjured && (
            <div className="mb-2">
              <span className="bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full text-sm font-medium">
                {t("stats.injured")}
              </span>
            </div>
          )}
          <p className="text-xl font-medium text-blue-200 capitalize">{player.name}</p>
          <div className="flex gap-x-4 text-sm text-blue-100">
            {player.playerPosition && <p>{player.playerPosition.name}</p>}
          </div>
          {isLatestSeason && (
            <div className="flex gap-x-4 font-medium text-sm text-blue-400">
              {numOfDaysAgo != null ? (
                <p>
                  {t("lastUpdate.lastUpdate")}{" "}
                  {numOfDaysAgo === 0
                    ? t("lastUpdate.today")
                    : `${numOfDaysAgo} ${t("lastUpdate.daysAgo")}`}
                </p>
              ) : (
                <p>{t("lastUpdate.noRecentData")}</p>
              )}
              {lastUpdateDate && <p>({lastUpdateDate})</p>}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-x-8">
        <div className="flex flex-col items-center">
          <p className="text-base mb-2 text-gray-100">{t("stats.performance")}</p>
          <CircularProgress
            progress={performanceScore ?? undefined}
            color={getCircularProgressColor(performanceScore ?? undefined, "performance")}
            size={60}
            strokeWidth={4}
            textSize="text-base"
          />
        </div>
        <div className="flex flex-col items-center">
          <p className="text-base mb-2 text-gray-100">{t("stats.injuryRisk")}</p>
          <CircularProgress
            progress={injuryScore ?? undefined}
            color={getCircularProgressColor(injuryScore ?? undefined, "injury")}
            size={60}
            strokeWidth={4}
            textSize="text-base"
          />
        </div>
        <ChevronRightIcon className="w-6 h-6 ml-4" />
      </div>
    </Link>
  );
};

export const getPlayerPicture = (player: { profilePicture?: IFile; id: number }) => {
  if (player.profilePicture) {
    return formatFileToUrl(player.profilePicture);
  }

  switch (player.id) {
    case 10:
      return "/players/patrick.png";
    case 190:
      return "/players/kiki.png";
    case 559:
      return "/players/janelle.png";
    case 562:
      return "/players/leila.png";
    default:
      return "/players/curry.png";
  }
};

const PlayerPicture = ({ url, name }: { url: string; name: string }) => {
  return (
    <div className="relative w-[80px] h-[80px] flex items-center justify-center">
      <div className="w-full h-full bg-[#2a3347] border border-[#3a4454] rounded-full flex items-center justify-center p-1">
        <img
          src={url}
          alt={name}
          width={120}
          height={120}
          className="rounded-full object-cover w-full h-full"
        />
      </div>
    </div>
  );
};
