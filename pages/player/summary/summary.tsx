import { ChevronLeftIcon } from "lucide-react";
import { type ComponentProps, useEffect, useState, useCallback } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { InsightsSection } from "./components/insights";
import { Loader } from "../../../components/ui/loader";
import { useDateStore } from "../../../store/date-store";
import { useTranslation } from "react-i18next";
import { DateNavigation } from "../../../components/ui/date-navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { ScoreCard } from "../../../components/ui/score-card";
import { PriorityCard } from "../../../components/ui/priority-card";
import dayjs from "dayjs";
import { useGetAthlete } from "../../../lib/query/athletes/get_athlete";
import { useGetInsights } from "../../../lib/query/insights/get_insights";
import { useDevMode } from "../../../hooks/useDevMode";
import { useUserPreferencesStore } from "../../../store/user-preferences-store";

const SummaryPage = () => {
  const { t } = useTranslation("summary");
  const { t: tCommon } = useTranslation("common");
  const { playerId } = useParams();
  const { athleteDate } = useDateStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [daysWithStats, setDaysWithStats] = useState<dayjs.Dayjs[]>([]);
  const [currentDayIndex, setCurrentDayIndex] = useState<number | null>(null);
  const [prioritySortBy, setPrioritySortBy] = useState<
    "priority-asc" | "priority-desc" | "category"
  >("priority-asc");
  const category = searchParams.get("category") === "injury" ? "injury" : "performance";
  const isDev = useDevMode();
  const { isChatOpen, chatWidth } = useUserPreferencesStore();

  const type = searchParams.get("type");

  const { data: athlete } = useGetAthlete(playerId);
  const { data: insights } = useGetInsights(playerId, athleteDate ?? undefined, category);
  const baseHref = `/player/${playerId}/summary?type=`;
  const handleCategoryChange = useCallback(
    (newCategory: "performance" | "injury") => {
      navigate(`${baseHref}${type}&category=${newCategory}`);
    },
    [navigate, type, baseHref],
  );

  const handleNutritionDetailClick = (macroType?: string) => {
    const url = macroType
      ? `/player/${playerId}/nutrition-detail?macro=${macroType}`
      : `/player/${playerId}/nutrition-detail`;
    navigate(url);
  };

  useEffect(() => {
    if (!isDev || !playerId) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      const key = event.key;
      const baseHref = `/player/${playerId}/summary?type=`;

      switch (key) {
        case "1":
          navigate(`${baseHref}activity&category=${category}`);
          break;
        case "2":
          navigate(`${baseHref}sleep&category=${category}`);
          break;
        case "3":
          navigate(`${baseHref}nutrition&category=${category}`);
          break;
        case "4":
          navigate(`${baseHref}health&category=${category}`);
          break;
        case "5":
          handleCategoryChange("performance");
          break;
        case "6":
          handleCategoryChange("injury");
          break;
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isDev, playerId, category, navigate, handleCategoryChange]);

  useEffect(() => {
    if (athlete) {
      const sortedDays = athlete.days.map((day) => dayjs(day.dateOfDay)).sort((a, b) => a.diff(b));
      setDaysWithStats(sortedDays);

      // Set current day index based on athleteDate
      if (athleteDate && sortedDays.length > 0) {
        const storedDate = dayjs(athleteDate);
        const index = sortedDays.findIndex((date) => date.isSame(storedDate, "day"));
        setCurrentDayIndex(index !== -1 ? index : sortedDays.length - 1);
      } else {
        setCurrentDayIndex(sortedDays.length - 1);
      }
    }
  }, [athlete, athleteDate]);

  if (!type) {
    return <div>{t("noDateOrType")}</div>;
  }

  if (!insights || !playerId || currentDayIndex === null || !athlete) {
    return <Loader />;
  }

  const selectedDate = daysWithStats[currentDayIndex];

  const handlePreviousDay = () => {
    if (currentDayIndex > 0) {
      setCurrentDayIndex(currentDayIndex - 1);
    }
  };

  const handleNextDay = () => {
    if (currentDayIndex < daysWithStats.length - 1) {
      setCurrentDayIndex(currentDayIndex + 1);
    }
  };

  const handleDateChange = (newDate: dayjs.Dayjs) => {
    const newIndex = daysWithStats.findIndex((date) => date.isSame(newDate, "day"));
    if (newIndex !== -1) {
      setCurrentDayIndex(newIndex);
    }
  };

  const getAllInsightsSortedByPriority = () => {
    const allInsights = [
      ...insights.activityInsight.insights,
      ...insights.sleepInsight.insights,
      ...insights.nutritionInsight.insights,
      ...insights.healthInsight.insights,
    ];

    const nonOptimalInsights = allInsights.filter(
      (insight) => insight.priority !== null && insight.priority !== undefined,
    );

    if (prioritySortBy === "priority-asc") {
      return nonOptimalInsights.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    } else if (prioritySortBy === "priority-desc") {
      return nonOptimalInsights.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    } else {
      const categoryOrder = ["activity", "sleep", "nutrition", "health"];
      return nonOptimalInsights.sort((a, b) => {
        const categoryDiff = categoryOrder.indexOf(a.type) - categoryOrder.indexOf(b.type);
        if (categoryDiff !== 0) return categoryDiff;
        return (a.priority ?? 0) - (b.priority ?? 0);
      });
    }
  };

  const scoreCards: Array<ComponentProps<typeof ScoreCard>> = [
    {
      score: insights.activityInsight.score,
      label: t("scores.activity"),
      selected: type === "activity",
      href: `${baseHref}activity&category=${category}`,
    },
    {
      score: insights.sleepInsight.score,
      label: t("scores.sleep"),
      selected: type === "sleep",
      href: `${baseHref}sleep&category=${category}`,
    },
    {
      score:
        category === "performance" || (insights.injuryScore !== null && insights.injuryScore >= 0)
          ? insights.nutritionInsight.score
          : undefined,
      label: t("scores.nutrition"),
      selected: type === "nutrition",
      href: `${baseHref}nutrition&category=${category}`,
    },
    {
      score: insights.healthInsight.score,
      label: t("scores.health"),
      selected: type === "health",
      href: `${baseHref}health&category=${category}`,
    },
  ];

  const priorityCount = getAllInsightsSortedByPriority().length;

  const getCurrentInsight = () => {
    switch (type) {
      case "activity":
        return insights.activityInsight.insights;
      case "sleep":
        return insights.sleepInsight.insights;
      case "nutrition":
        return insights.nutritionInsight.insights;
      case "health":
        return insights.healthInsight.insights;
      case "priority":
        return getAllInsightsSortedByPriority();
      default:
        return [];
    }
  };

  return (
    <div
      className="flex flex-col items-center  gap-y-6 sm:gap-y-8"
      style={isChatOpen ? { marginRight: `${chatWidth - 24}px` } : undefined}
    >
      <div className="flex flex-row justify-between w-full items-center">
        <Link
          to={`/player/${playerId}?category=${category}`}
          className="flex flex-row gap-3 items-center w-fit hover:opacity-90 transition-opacity"
        >
          <ChevronLeftIcon className="w-6 h-6 flex-shrink-0" />
          <p className="text-2xl font-medium">{t("title", { name: athlete.name })}</p>
        </Link>
      </div>
      <Tabs value={category} className="w-full">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <TabsList>
            <TabsTrigger value="performance" onClick={() => handleCategoryChange("performance")}>
              {tCommon("tabs.performance")}{" "}
              {insights.performanceScore !== null &&
                insights.performanceScore >= 0 &&
                `(${Math.round(insights.performanceScore)})`}
            </TabsTrigger>
            <TabsTrigger value="injury" onClick={() => handleCategoryChange("injury")}>
              {tCommon("tabs.injury")}{" "}
              {insights.injuryScore !== null &&
                insights.injuryScore >= 0 &&
                `(${Math.round(insights.injuryScore === 0 ? 1 : insights.injuryScore)})`}
            </TabsTrigger>
          </TabsList>
          <div className="bg-[#252d3b] rounded-xl hover:shadow-md transition-shadow border border-[#3a4454] p-1">
            <DateNavigation
              daysWithStats={daysWithStats}
              selectedDate={selectedDate}
              currentDayIndex={currentDayIndex}
              onPreviousDay={handlePreviousDay}
              onNextDay={handleNextDay}
              onDateChange={handleDateChange}
              type="athlete"
            />
          </div>
        </div>
        <TabsContent value="performance">
          <div className="flex mb-4 items-start gap-4 flex-wrap">
            <div className="order-2 sm:order-1 grid items-start justify-start auto-rows-min gap-4 grid-cols-[repeat(auto-fit,minmax(min(calc(50%-0.5rem),7rem),auto))] flex-1">
              {scoreCards.map((scoreCard) => (
                <ScoreCard key={scoreCard.label} {...scoreCard} />
              ))}
            </div>
            <div className="order-1 sm:order-2 w-full sm:w-auto sm:ml-auto flex sm:justify-end">
              <PriorityCard
                count={priorityCount}
                selected={type === "priority"}
                href={`${baseHref}priority&category=${category}`}
              />
            </div>
          </div>
          <InsightsSection
            insights={getCurrentInsight()}
            playerId={+playerId}
            category={category}
            onNutritionDetailClick={handleNutritionDetailClick}
            type={type}
            prioritySortBy={prioritySortBy}
            onPrioritySortChange={setPrioritySortBy}
          />
        </TabsContent>
        <TabsContent value="injury">
          <div className="flex mb-4 items-start gap-4 flex-wrap">
            <div className="order-2 sm:order-1 grid items-start justify-start auto-rows-min gap-4 grid-cols-[repeat(auto-fit,minmax(min(calc(50%-0.5rem),7rem),auto))] flex-1">
              {scoreCards.map((scoreCard) => (
                <ScoreCard key={scoreCard.label} {...scoreCard} />
              ))}
            </div>
            <div className="order-1 sm:order-2 w-full sm:w-auto sm:ml-auto flex sm:justify-end">
              <PriorityCard
                count={priorityCount}
                selected={type === "priority"}
                href={`${baseHref}priority&category=${category}`}
              />
            </div>
          </div>
          <InsightsSection
            insights={getCurrentInsight()}
            playerId={+playerId}
            category={category}
            onNutritionDetailClick={handleNutritionDetailClick}
            type={type}
            prioritySortBy={prioritySortBy}
            onPrioritySortChange={setPrioritySortBy}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SummaryPage;
