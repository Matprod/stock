import dayjs from "dayjs";
import { useMemo } from "react";
import type { IPlayer } from "../types/player.types";
import { getDataForTimeScale } from "../utils/get_data_for_time_scale";
import { CausalIndicators } from "./player/causal_indicators";
import { DayStats } from "./player/day_stats";
import { DaysRepartition } from "./player/days_repartition";
import { Evolution } from "./player/evolution";
import { PhysicalPains } from "./player/physical_pains";
import { InjuryHistory } from "./player/injury_history";
import { TimeScaleSelector } from "./time_scale_selector";
import { getCurrentSeason } from "../utils/get_current_season";
import { useSeasonStore } from "../store/season-store";
import { useUserPreferencesStore } from "../store/user-preferences-store";
import useGetSeasons from "../lib/query/seasons/get_seasons";

interface IStatsProps {
  player: IPlayer;
  type: "injury" | "performance";
}

const CLUB_SUNDERLAND_ID = 9;

export const Stats = ({ player, type }: IStatsProps) => {
  const { data: seasons } = useGetSeasons();
  const clubId = seasons?.[0]?.clubId ?? null;
  const shouldHidePhysicalPains = clubId === CLUB_SUNDERLAND_ID;
  const { timeScale, setTimeScale } = useUserPreferencesStore();
  const { selectedSeasonId } = useSeasonStore();
  const currentSeason = useMemo(() => {
    if (!selectedSeasonId) {
      return getCurrentSeason(player.club.seasons, true);
    }
    return player.club.seasons.find((season) => season.id === selectedSeasonId);
  }, [player.club.seasons, selectedSeasonId]);

  const daysForTimeScale = useMemo(() => {
    return getDataForTimeScale(player.days, timeScale, "dateOfDay", currentSeason)
      .filter((day) =>
        type === "performance" ? day.finalScore !== null : day.injuryScore !== null,
      )
      .sort((a, b) => dayjs(a.dateOfDay).diff(dayjs(b.dateOfDay)));
  }, [player.days, timeScale, type, currentSeason]);

  const discomfortsForTimeScale = useMemo(() => {
    return getDataForTimeScale(player.discomforts, timeScale, "dateOfDiscomfort", currentSeason);
  }, [player.discomforts, timeScale, currentSeason]);

  const injuriesForTimeScale = useMemo(() => {
    const ongoingInjuries = player.injuries.filter((injury) => !injury.recoveryDate);
    const injuries = getDataForTimeScale(player.injuries, timeScale, "dateOfInjury", currentSeason);

    return [...new Set([...ongoingInjuries, ...injuries])];
  }, [player.injuries, timeScale, currentSeason]);

  return (
    <div className="flex flex-col gap-y-4">
      <DayStats days={player.days} type={type} playerId={player.id} />
      <div className="p-4 flex flex-col border border-[#4c648a] rounded-3xl gap-y-4">
        <TimeScaleSelector
          currentTimeScale={timeScale}
          setCurrentTimeScale={setTimeScale}
          season={currentSeason}
        />
        <div className="flex flex-row gap-x-4">
          <div className="w-1/2">
            <CausalIndicators days={daysForTimeScale} type={type} />
          </div>
          <div className="w-1/2">
            <DaysRepartition days={daysForTimeScale} type={type} />
          </div>
        </div>
        <div className="w-full">
          <Evolution
            days={daysForTimeScale}
            injuries={injuriesForTimeScale}
            type={type}
            playerId={player.id}
          />
        </div>
        <div className="flex flex-row gap-x-4 items-stretch">
          {!shouldHidePhysicalPains && (
            <div className="w-1/2 flex">
              <PhysicalPains discomforts={discomfortsForTimeScale} days={daysForTimeScale} />
            </div>
          )}
          <div className="w-1/2 flex">
            <InjuryHistory injuries={injuriesForTimeScale} />
          </div>
        </div>
      </div>
    </div>
  );
};
