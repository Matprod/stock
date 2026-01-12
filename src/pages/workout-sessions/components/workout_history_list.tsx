import { useState, useMemo, useCallback } from "react";
import { useGetWorkoutsHistory } from "../../../lib/query/workout/get_workouts_history";
import { useTranslation } from "react-i18next";
import type { APIWorkoutHistory, PlayerModification } from "../../../types/workout.types";
import { Button } from "../../../components/ui/button";
import { Calendar, Clock, Dumbbell, Play, Users, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Badge } from "../../../components/ui/badge";
import useGetAthletes from "../../../lib/query/athletes/get_athletes";
import { getPlayerPicture } from "../../../components/player/player_card";
import type { DateRange } from "../../../components/ui/date-range-picker";
import { DateRangePicker } from "../../../components/ui/date-range-picker";
import { MultiSelect } from "../../../components/ui/multi-select";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
import {
  findModificationForSet,
  groupAndSortExercisesByName,
  sortExercisesByOrder,
} from "../utils/player_modifications";
import { ModificationBadge, PlayerModificationBadges } from "./badge";
import { getLocalizedName, getSupportedLanguage } from "../../../utils/language_config";
import { RenderPlayerExercises } from "./render_player_exercises";
import { twMerge } from "tailwind-merge";

const WorkoutHistoryList = ({
  setSelectedSession,
}: { setSelectedSession: (session: APIWorkoutHistory) => void }) => {
  const { data: history } = useGetWorkoutsHistory();
  const { data: athletes } = useGetAthletes();
  const { t, i18n } = useTranslation("workout");
  const currentLanguage = getSupportedLanguage(i18n.language);

  const [selectedInstance, setSelectedInstance] = useState<APIWorkoutHistory | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  const uniquePlayers = useMemo(() => {
    if (!history || !athletes) return [];
    const playerIds = new Set(
      history.flatMap((instance) =>
        instance.sportActivities.map((activity) => activity.athleteDay.athleteId),
      ),
    );
    return Array.from(playerIds)
      .map((id) => athletes.find((a) => a.id === id)?.name)
      .filter((name): name is string => !!name)
      .sort();
  }, [history, athletes]);

  const filteredHistory = useMemo(() => {
    if (!history) return [];
    const athleteMap = new Map(athletes?.map((a) => [a.id, a.name]) ?? []);
    return history.filter((instance) => {
      const sessionDate = dayjs(instance.startTime);
      const isInDateRange =
        (!dateRange.from || sessionDate.isSameOrAfter(dateRange.from, "day")) &&
        (!dateRange.to || sessionDate.isSameOrBefore(dateRange.to, "day"));

      if (selectedPlayers.length === 0) return isInDateRange;
      return (
        isInDateRange &&
        instance.sportActivities.some((activity) => {
          const playerName = athleteMap.get(activity.athleteDay.athleteId);
          return playerName && selectedPlayers.includes(playerName);
        })
      );
    });
  }, [history, dateRange, selectedPlayers, athletes]);

  const clearFilters = useCallback(() => {
    setDateRange({ from: undefined, to: undefined });
    setSelectedPlayers([]);
  }, []);

  const formatDate = (dateString: string) =>
    dayjs(dateString).format(
      i18n.language === "fr" ? "D MMMM YYYY, HH:mm" : "MMMM D, YYYY, hh:mm a",
    );

  const handleInstanceClick = useCallback((instance: APIWorkoutHistory) => {
    setSelectedInstance(instance);
    setIsModalOpen(true);
  }, []);

  const handleReprogramSession = useCallback(
    (instance: APIWorkoutHistory) => {
      setIsModalOpen(false);
      setSelectedSession(instance);
    },
    [setSelectedSession],
  );

  const getUniqueExercises = (instance: APIWorkoutHistory) =>
    Array.from(
      new Set(
        instance.exercises
          .map((ex) => getLocalizedName(ex.exercise, currentLanguage))
          .filter((name): name is string => !!name),
      ),
    );

  const renderSet = (
    set: APIWorkoutHistory["exercises"][number],
    index: number,
    modification?: ReturnType<typeof findModificationForSet>,
    variant: "simple" | "withModifications" = "simple",
  ) => {
    const isSimple = variant === "simple";
    const renderValue = (label: string, value: string | number) => {
      if (isSimple) {
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="font-semibold text-lg">{value}</span>
          </div>
        );
      }
      return (
        <>
          <span className="text-muted-foreground">{label}</span> <strong>{value}</strong>
        </>
      );
    };

    return (
      <div
        key={set.id}
        className={twMerge(
          "flex items-center rounded",
          isSimple ? "gap-4 pl-4" : "gap-3 text-sm pl-3",
        )}
      >
        <span
          className={twMerge(
            "text-muted-foreground",
            isSimple ? "font-medium min-w-[80px]" : "min-w-[60px]",
          )}
        >
          {t("exercise.series")} {index + 1}
        </span>
        <div className={twMerge("flex", isSimple ? "gap-6 flex-1" : "gap-4")}>
          {set.reps != null && renderValue(`${t("exercise.reps")}:`, set.reps)}
          {set.weight != null &&
            renderValue(`${t("exercise.weight").replace(" (kg)", "")}:`, `${set.weight} kg`)}
          {set.time != null && renderValue(`${t("exercise.time")}:`, set.time)}
        </div>
        {!isSimple && modification && <ModificationBadge modification={modification} />}
      </div>
    );
  };

  const hasActiveFilters = dateRange.from || selectedPlayers.length > 0;
  const renderExercise = (
    exerciseName: string,
    sets: APIWorkoutHistory["exercises"],
    options?: {
      modifications?: PlayerModification[];
      isNewExercise?: boolean;
      variant?: "simple" | "withModifications";
    },
  ) => {
    const variant = options?.variant ?? "simple";
    const isNewExercise = options?.isNewExercise ?? false;
    const uniqueKey = sets[0]?.id || `${exerciseName}-${sets[0]?.exerciseId || 0}`;

    return variant === "simple" ? (
      <Card key={uniqueKey} className="p-4">
        <h4 className="font-semibold text-lg mb-3">{exerciseName}</h4>
        <div className="space-y-2">
          {sets.map((set, index) => renderSet(set, index, undefined, variant))}
        </div>
      </Card>
    ) : (
      <div key={uniqueKey} className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm text-muted-foreground">{exerciseName}</p>
          {isNewExercise && (
            <span
              className={twMerge(
                "px-1.5 py-0.5 rounded text-xs border flex items-center gap-1",
                "bg-green-500/20 text-green-300 border-green-500/30",
              )}
            >
              <strong>+ {t("modification.newExercise")}</strong>
            </span>
          )}
        </div>
        <div className="space-y-1">
          {sets.map((set, index) =>
            renderSet(
              set,
              index,
              options?.modifications
                ? findModificationForSet(set.exercise, index, options.modifications)
                : undefined,
              variant,
            ),
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-end gap-4">
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          placeholder={t("history.pickDateRange")}
          buttonClassName="h-10 text-base justify-start text-left font-medium bg-background text-gray-100 border-white/20 hover:bg-white/10"
          popoverClassName="bg-background-dark-blue border rounded-md shadow-md"
        />
        <MultiSelect
          options={uniquePlayers}
          selected={selectedPlayers}
          onChange={setSelectedPlayers}
          getLabel={(player) => player}
          getValue={(player) => player}
          buttonText={(count) =>
            t("player.selected", {
              count,
              defaultValue: count === 0 ? "Select players..." : "{{count}} player(s) selected",
            })
          }
          placeholder={t("player.searchPlaceholder")}
          emptyText={t("player.noneFound")}
          className="w-[280px] justify-center h-10 text-base bg-background text-gray-100 border-white/20 font-medium hover:bg-white/10"
          popoverClassName="bg-background-dark-blue border rounded-md shadow-md z-50"
        />
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearFilters}
            className="h-10 w-10 hover:bg-destructive/10 hover:text-destructive text-gray-100"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>
      {filteredHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-center text-muted-foreground text-lg">
            {!history?.length ? t("history.noSessions") : t("history.noSessionsFiltered")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHistory.map((instance) => {
            const uniqueExercises = getUniqueExercises(instance);
            const playerCount = instance.sportActivities.length;

            return (
              <Card
                key={instance.id}
                className={twMerge(
                  "bg-[#252d3b] hover:bg-[#323d56] group hover:shadow-lg",
                  "transition-all duration-300 cursor-pointer border-border/50",
                )}
                onClick={() => handleInstanceClick(instance)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold">{instance.title}</CardTitle>
                    <div className="h-2 w-2 rounded-full bg-primary/60" />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(instance.startTime)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 tracking-wide">
                        {t("history.exercisesCount", { count: uniqueExercises.length })}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {uniqueExercises.map((exercise) => (
                          <Badge
                            key={exercise}
                            variant="secondary"
                            className="text-xs px-2 py-1 bg-main-gray"
                          >
                            {exercise}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{t("player.players", { count: playerCount })}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Dumbbell className="h-6 w-6" />
              {selectedInstance?.title}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-4 text-base mt-2">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {selectedInstance && formatDate(selectedInstance.startTime)}
              </div>
              {selectedInstance?.duration && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {selectedInstance.duration} {t("session.min")}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedInstance && (
            <div className="space-y-6 mt-4">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Dumbbell className="h-5 w-5" />
                    {t("exercise.performed")}
                  </h3>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleReprogramSession(selectedInstance)}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  {Array.from(
                    groupAndSortExercisesByName(selectedInstance.exercises, currentLanguage),
                  )
                    .sort(sortExercisesByOrder)
                    .map(([exerciseName, sets]) => renderExercise(exerciseName, sets))}
                </div>
              </div>

              {/* Section Joueurs */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t("player.participantsCount", {
                    count: selectedInstance.sportActivities.length,
                  })}
                </h3>
                <div className="space-y-4">
                  {selectedInstance.sportActivities.map((activity) => {
                    const athlete = athletes?.find(
                      (athlete) => athlete.id === activity.athleteDay.athleteId,
                    );

                    if (!athlete) return null;

                    return (
                      <Card key={activity.id} className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#3a4454]">
                              <img
                                src={getPlayerPicture(athlete)}
                                alt={athlete.name}
                                className="object-cover w-full h-full"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-lg">{athlete.name}</h4>
                            </div>
                            <div className="flex items-center gap-4">
                              {activity.trainingLoad && (
                                <p>
                                  {t("history.trainingLoad", {
                                    value: Math.round(activity.trainingLoad),
                                  })}
                                </p>
                              )}
                              <PlayerModificationBadges
                                baseExercises={selectedInstance.exercises}
                                playerExerciseSets={activity.exerciseSets}
                              />
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              handleReprogramSession({
                                ...selectedInstance,
                                sportActivities: selectedInstance.sportActivities.filter(
                                  (a) => a.athleteDay.athleteId === athlete.id,
                                ),
                              })
                            }
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        </div>

                        {activity.exerciseSets.length > 0 && (
                          <div className="space-y-3 ml-7">
                            <RenderPlayerExercises
                              baseExercises={selectedInstance.exercises}
                              playerExerciseSets={activity.exerciseSets}
                              currentLanguage={currentLanguage}
                              renderExercise={renderExercise}
                            />
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WorkoutHistoryList;
