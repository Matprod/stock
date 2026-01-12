import { useMemo } from "react";
import { InfoIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import type { APIInjury, IPlayer, IPosition } from "../../types/player.types";
import { Averages } from "./components/averages";
import { DayStats } from "./components/day_stats";
import PlayerList, { PlayerListItem } from "../../components/ui/player_list";
import { Loader } from "../../components/ui/loader";
import { useDateStore } from "../../store/date-store";
import { getPlayerCurrentInjury } from "../../utils/is_player_injured";
import dayjs from "dayjs";
import { useGetAthletesList } from "../../lib/query/athletes/get_athletes_list";

const DashBoard = () => {
  const { t } = useTranslation("dashboard");
  const { teamDate } = useDateStore();
  const { data: team = [], isLoading } = useGetAthletesList();

  const playersWithCurrentInjury: Array<IPlayer & { currentInjury?: APIInjury }> = useMemo(() => {
    if (!teamDate) {
      return [];
    }
    return team.map((player) => {
      const injury = getPlayerCurrentInjury(player, teamDate);
      return {
        ...player,
        currentInjury: injury,
      };
    });
  }, [team, teamDate]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <>
      <h1 className="font-medium text-4xl text-center text-white-400 mb-14 pb-4 border-b border-[#3a4454]">
        {t("title")}
      </h1>
      <Tabs defaultValue="performance">
        <TabsList className="gap-x-8 mb-4">
          <TabsTrigger value="performance">{t("tabs.performance")}</TabsTrigger>
          <TabsTrigger value="injury">{t("tabs.injury")}</TabsTrigger>
        </TabsList>
        <TabContent type="injury" team={playersWithCurrentInjury} />
        <TabContent type="performance" team={team} />
      </Tabs>
    </>
  );
};

interface ITabContent {
  type: "injury" | "performance";
  team: Array<IPlayer & { currentInjury?: APIInjury }>;
}

const TabContent = ({ type, team }: ITabContent) => {
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");
  const { teamDate } = useDateStore();

  const sortedInjuredPlayers = team
    .filter((player) => player.currentInjury)
    .sort((a, b) => {
      const aInjury = a.currentInjury;
      const bInjury = b.currentInjury;
      return dayjs(bInjury?.dateOfInjury).diff(dayjs(aInjury?.dateOfInjury));
    });

  return (
    <TabsContent value={type}>
      <div className="flex flex-col gap-y-8">
        <div className="p-4 border border-[#4c648a] rounded-3xl flex flex-col gap-y-4">
          <DayStats type={type} team={team} />
          {type === "injury" && (
            <div className="flex flex-row gap-x-4">
              <PlayerList
                team={team}
                title={t("playerLists.topInjured")}
                threshold={0}
                valueKey="injuryScore"
                valueColor="text-red-500"
                valueLabel={tCommon("risk")}
                limit={5}
                sortOrder="desc"
                date={teamDate ?? undefined}
                info={t("playerLists.info.topInjured")}
              />

              <div className="flex bg-[#252d3b] border border-[#3a4454] rounded-3xl flex-col w-full card p-6">
                <div className="text-xl font-medium text-gray-100 mb-4 flex items-center gap-x-2">
                  {t("playerLists.injured")}
                  <div className="group relative">
                    <InfoIcon className="w-4 h-4 text-gray-400 hover:text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#142836fc] text-gray-100 text-xs rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-normal z-10 w-[220px] shadow-lg">
                      {t("playerLists.info.injured")}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-y-4">
                  {sortedInjuredPlayers
                    .filter(
                      (
                        player,
                      ): player is IPlayer & {
                        currentInjury: APIInjury;
                        playerPosition: IPosition;
                      } => !!player.currentInjury && !!player.playerPosition,
                    )
                    .map((player) => (
                      <PlayerListItem
                        key={player.id}
                        player={player}
                        valueColor="text-red-500"
                        valueLabel={t("playerLists.injuredSince", {
                          date: dayjs(player.currentInjury?.dateOfInjury).format("DD/MM/YYYY"),
                        })}
                      />
                    ))}
                </div>
              </div>
            </div>
          )}
          {type === "performance" && (
            <div className="flex flex-row gap-x-4">
              <PlayerList
                team={team}
                title={t("playerLists.topPerformance")}
                threshold={0}
                valueKey="finalScore"
                valueColor="text-green-500"
                valueLabel={tCommon("performance")}
                limit={5}
                sortOrder="desc"
                date={teamDate ?? undefined}
                info={t("playerLists.info.topPerformance")}
              />
              <PlayerList
                team={team}
                title={t("playerLists.highPerformance")}
                threshold={40}
                valueKey="finalScore"
                sortOrder="desc"
                valueColor="text-green-500"
                valueLabel={tCommon("performance")}
                date={teamDate ?? undefined}
                info={t("playerLists.info.highPerformance")}
              />
            </div>
          )}
        </div>
        <Averages team={team} type={type} />
      </div>
    </TabsContent>
  );
};

export default DashBoard;
