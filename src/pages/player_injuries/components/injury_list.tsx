import { type FC, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { useGetInjuries } from "../../../lib/query/injury/get_injuries";
import type { APIInjury } from "../../../types/player.types";
import InjuryCard from "./injury_card";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import FilterControls from "../../../components/ui/filter_controls";
import type { DateRange } from "../../../components/ui/date-range-picker";
import { useSeasonStore } from "../../../store/season-store";
import useGetSeasons from "../../../lib/query/seasons/get_seasons";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

interface InjuryListProps {
  setInjury: (injury: APIInjury | null) => void;
  setIsModalOpen: (isOpen: boolean) => void;
}

const InjuryList: FC<InjuryListProps> = ({ setInjury, setIsModalOpen }) => {
  const { data: injuries = [] } = useGetInjuries();
  const [tab, setTab] = useState<"active" | "past">("active");
  const { t } = useTranslation("injury");
  const today = dayjs();
  const { selectedSeasonId } = useSeasonStore();
  const { data: seasons = [] } = useGetSeasons();

  const selectedSeason = useMemo(() => {
    if (!selectedSeasonId) return null;
    return seasons.find((season) => season.id === selectedSeasonId) || null;
  }, [selectedSeasonId, seasons]);

  const seasonMinDate = useMemo(() => {
    if (!selectedSeason) return undefined;
    return dayjs(selectedSeason.startDate).toDate();
  }, [selectedSeason]);

  const seasonMaxDate = useMemo(() => {
    if (!selectedSeason) return undefined;
    const seasonEndDate = dayjs(selectedSeason.endDate);
    return (seasonEndDate.isAfter(today) ? today : seasonEndDate).toDate();
  }, [selectedSeason, today]);

  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [selectedPlayer, setSelectedPlayer] = useState<string | undefined>(undefined);

  const filterInjuriesByDateRange = (injuries: APIInjury[], dateRange: DateRange) => {
    return injuries.filter((injury) => {
      if (!dateRange.from && !dateRange.to) return true;
      if (dateRange.from && dateRange.to && dayjs(dateRange.to).isBefore(dateRange.from)) {
        return false;
      }
      if (!injury.recoveryDate || dayjs(injury.recoveryDate).isAfter(today)) {
        const injuryDate = injury.dateOfInjury ? dayjs(injury.dateOfInjury) : null;
        if (!injuryDate) return true;
        return (
          (!dateRange.from || injuryDate.isSameOrAfter(dateRange.from, "day")) &&
          (!dateRange.to || injuryDate.isSameOrBefore(dateRange.to, "day"))
        );
      }
      const recoveryDate = dayjs(injury.recoveryDate);
      return (
        (!dateRange.from || recoveryDate.isSameOrAfter(dateRange.from, "day")) &&
        (!dateRange.to || recoveryDate.isSameOrBefore(dateRange.to, "day"))
      );
    });
  };

  const filterInjuriesByPlayer = (injuries: APIInjury[], selectedPlayer: string | undefined) => {
    return injuries.filter((injury) => {
      if (!injury.athlete?.name) return false;
      return !selectedPlayer || injury.athlete.name === selectedPlayer;
    });
  };

  const activeInjuriesBase = injuries.filter(
    (injury) => !injury.recoveryDate || dayjs(injury.recoveryDate).isAfter(today),
  );

  const pastInjuriesBase = injuries.filter(
    (injury) => injury.recoveryDate && dayjs(injury.recoveryDate).isBefore(today),
  );

  const uniquePlayers = useMemo(() => {
    if (tab === "active") {
      return Array.from(new Set(activeInjuriesBase.map((injury) => injury.athlete.name))).sort();
    }
    return Array.from(new Set(pastInjuriesBase.map((injury) => injury.athlete.name))).sort();
  }, [activeInjuriesBase, pastInjuriesBase, tab]);

  const activeInjuries = filterInjuriesByPlayer(
    filterInjuriesByDateRange(activeInjuriesBase, dateRange),
    selectedPlayer,
  );

  const pastInjuries = filterInjuriesByPlayer(
    filterInjuriesByDateRange(pastInjuriesBase, dateRange),
    selectedPlayer,
  ).sort((a, b) => {
    if (!a.recoveryDate || !b.recoveryDate) return 0;
    return dayjs(b.recoveryDate).diff(dayjs(a.recoveryDate));
  });

  const handleEditInjury = (injury: APIInjury) => {
    setInjury(injury);
    setIsModalOpen(true);
  };

  const clearFilters = () => {
    setDateRange({ from: undefined, to: undefined });
    setSelectedPlayer(undefined);
  };

  return (
    <div className="card w-full bg-[#252d3b] rounded-3xl border border-[#3a4454] p-6">
      <Tabs defaultValue="active">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="gap-x-8">
            <TabsTrigger value="active" onClick={() => setTab("active")}>
              {t("activeInjuries")} ({activeInjuries.length})
            </TabsTrigger>
            <TabsTrigger value="past" onClick={() => setTab("past")}>
              {t("pastInjuries")} ({pastInjuries.length})
            </TabsTrigger>
          </TabsList>

          <FilterControls
            dateRange={dateRange}
            setDateRange={setDateRange}
            selectedPlayer={selectedPlayer}
            setSelectedPlayer={setSelectedPlayer}
            uniquePlayers={uniquePlayers}
            onClearFilters={clearFilters}
            minDate={seasonMinDate}
            maxDate={seasonMaxDate}
          />
        </div>

        <InjuryTab injuries={activeInjuries} value="active" onEdit={handleEditInjury} />

        <InjuryTab injuries={pastInjuries} value="past" onEdit={handleEditInjury} />
      </Tabs>
    </div>
  );
};

export default InjuryList;

interface InjuryTabProps {
  injuries: APIInjury[];
  value: "active" | "past";
  onEdit: (injury: APIInjury) => void;
}

const InjuryTab: FC<InjuryTabProps> = ({ injuries, value, onEdit }) => {
  return (
    <TabsContent value={value} className="space-y-4">
      <div className="space-y-2">
        {injuries.map((injury) => (
          <InjuryCard key={injury.id} injury={injury} type={value} onEdit={() => onEdit(injury)} />
        ))}
      </div>
    </TabsContent>
  );
};
