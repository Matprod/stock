import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ActiveElement,
  type Chart,
  type Plugin,
  type TooltipModel,
  type ScriptableLineSegmentContext,
  type ChartEvent as ChartJsEvent,
} from "chart.js";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { useNavigate } from "react-router-dom";
import { useDateStore } from "../../store/date-store";
import { useMemo, useState, useRef, useCallback } from "react";
import colors from "tailwindcss/colors";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";
import { cn } from "../../lib/utils";

dayjs.extend(isBetween);

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

export interface ChartEvent {
  startDate: string;
  endDate?: string | null;
  name: string;
  type: "injury" | "match";
}

interface DynamicLineChartProps {
  days: Array<{ dateOfDay: string; value: number }>;
  events?: ChartEvent[];
  type: "injury" | "performance";
  playerId?: number;
}

interface TooltipState {
  opacity: number;
  top: number;
  left: number;
  date: string;
  value: number;
  hideScore: boolean;
  activeEvents: ChartEvent[];
}

export const DynamicLineChart = ({ days, events = [], type, playerId }: DynamicLineChartProps) => {
  const { t } = useTranslation("player");
  const navigate = useNavigate();
  const { setAthleteDate } = useDateStore();

  const [tooltipState, setTooltipState] = useState<TooltipState>({
    opacity: 0,
    top: 0,
    left: 0,
    date: "",
    value: 0,
    hideScore: false,
    activeEvents: [],
  });
  const tooltipStateRef = useRef(tooltipState);

  const sortedDays = useMemo(() => {
    if (!days) return [];
    return [...days].sort(
      (a, b) => new Date(a.dateOfDay).getTime() - new Date(b.dateOfDay).getTime(),
    );
  }, [days]);

  const chartKey = useMemo(
    () => (!sortedDays?.length ? "empty" : `chart-${sortedDays.length}-${sortedDays[0].dateOfDay}`),
    [sortedDays],
  );

  const { injuryRangeMap, injuryStartSet, matchStartSet, matchEventsMap } = useMemo(() => {
    const rangeMap = new Map<number, ChartEvent[]>();
    const injuryStart = new Set<number>();
    const matchStart = new Set<number>();
    const matchEvents = new Map<number, ChartEvent[]>();

    if (!sortedDays.length || !events.length)
      return {
        injuryRangeMap: rangeMap,
        injuryStartSet: injuryStart,
        matchStartSet: matchStart,
        matchEventsMap: matchEvents,
      };

    events.forEach((e) => {
      const startIdx = findNearestPreviousIndex(sortedDays, e.startDate);

      if (startIdx === -1) return;

      if (e.type === "match") {
        matchStart.add(startIdx);
        const existing = matchEvents.get(startIdx) || [];
        existing.push(e);
        matchEvents.set(startIdx, existing);
      } else {
        const endIdx = findNearestPreviousIndex(sortedDays, e.endDate || new Date());
        injuryStart.add(startIdx);

        const rangeStart = Math.max(0, startIdx);
        const rangeEnd = Math.max(rangeStart, endIdx);

        for (let i = rangeStart; i < rangeEnd; i++) {
          const existing = rangeMap.get(i) || [];
          existing.push(e);
          rangeMap.set(i, existing);
        }
      }
    });

    return {
      injuryRangeMap: rangeMap,
      injuryStartSet: injuryStart,
      matchStartSet: matchStart,
      matchEventsMap: matchEvents,
    };
  }, [events, sortedDays]);

  const config = useMemo(() => {
    const isInj = type === "injury";
    return {
      lineColor: "white",
      dotColor: isInj ? colors.red[500] : colors.blue[500],
      fillColor: isInj ? colors.red[500] + "25" : colors.blue[500] + "25",
    };
  }, [type]);

  const chartData = useMemo(() => {
    const radii: number[] = [];
    const bgColors: string[] = [];
    const borderColors: string[] = [];
    const hoverRadii: number[] = [];

    sortedDays.forEach((_, idx) => {
      const isInjuryStart = injuryStartSet.has(idx);
      const isMatchStart = matchStartSet.has(idx);
      const isInRange = injuryRangeMap.has(idx);

      if (isMatchStart) {
        radii.push(6);
        bgColors.push(colors.sky[400]);
        borderColors.push("#fff");
        hoverRadii.push(8);
      } else if (isInjuryStart) {
        radii.push(6);
        bgColors.push(config.dotColor);
        borderColors.push("#fff");
        hoverRadii.push(8);
      } else {
        radii.push(0);
        bgColors.push(config.lineColor);
        borderColors.push("transparent");

        if (isInRange) {
          hoverRadii.push(0);
        } else {
          hoverRadii.push(7);
        }
      }
    });

    return {
      labels: sortedDays.map((d) => dayjs(d.dateOfDay).format("DD/MM")),
      datasets: [
        {
          label: "",
          data: sortedDays.map((d) => d.value),
          borderColor: config.lineColor,
          backgroundColor: config.lineColor + "33",
          tension: 0.4,

          pointRadius: radii,
          pointBackgroundColor: bgColors,
          pointBorderColor: borderColors,
          pointBorderWidth: 2,

          pointHoverRadius: hoverRadii,
          pointHoverBackgroundColor: config.lineColor,
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 2,

          fill: false,
          spanGaps: false,
          segment: {
            borderColor: (ctx: ScriptableLineSegmentContext) => {
              const idx0 = ctx.p0DataIndex;
              const idx1 = ctx.p1DataIndex;

              const p0Injured = injuryRangeMap.has(idx0);
              const p1Injured = injuryRangeMap.has(idx1);

              if (p0Injured && p1Injured) {
                return "transparent";
              }
              return config.lineColor;
            },
          },
        },
      ],
    };
  }, [sortedDays, injuryStartSet, injuryRangeMap, matchStartSet, config]);

  const scaleConfig = useMemo(() => {
    const maxVal = sortedDays.length ? Math.max(...sortedDays.map((d) => d.value)) : 0;
    return getScaleConfig(maxVal, type === "injury");
  }, [sortedDays, type]);

  const backgroundPlugin = useMemo(
    () =>
      createGapFillingBackgroundPlugin(
        events.filter((e) => e.type === "injury"),
        sortedDays,
        config.fillColor,
      ),
    [events, sortedDays, config.fillColor],
  );

  const handleTooltip = useCallback(
    (context: { chart: Chart; tooltip: TooltipModel<"line"> }) => {
      const model = context.tooltip;
      if (model.opacity === 0) {
        if (tooltipStateRef.current.opacity !== 0)
          setTooltipState((prev) => ({ ...prev, opacity: 0 }));
        return;
      }

      const idx = model.dataPoints[0].dataIndex;
      const currentDay = sortedDays[idx];
      const activeInjuries = injuryRangeMap.get(idx) || [];
      const activeMatches = matchEventsMap.get(idx) || [];
      const activeEvents = [...activeInjuries, ...activeMatches];

      const newState = {
        opacity: 1,
        left: model.caretX,
        top: model.caretY,
        date: currentDay.dateOfDay,
        value: model.dataPoints[0].raw as number,
        hideScore: activeInjuries.length > 0,
        activeEvents,
      };

      if (
        tooltipStateRef.current.opacity === 1 &&
        tooltipStateRef.current.date === newState.date &&
        tooltipStateRef.current.left === newState.left &&
        tooltipStateRef.current.activeEvents === newState.activeEvents
      )
        return;

      tooltipStateRef.current = newState;
      setTooltipState(newState);
    },
    [sortedDays, injuryRangeMap, matchEventsMap],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      backgroundColor: "transparent",
      animation: false as const,
      interaction: { mode: "index" as const, intersect: false, axis: "x" as const },
      onHover: (event: ChartJsEvent, elements: ActiveElement[]) => {
        const target = event.native?.target as HTMLElement;
        if (!target) return;
        target.style.cursor = elements.length ? "pointer" : "default";
      },
      onClick: (_: unknown, els: ActiveElement[]) => {
        if (els.length && playerId) {
          const index = els[0].index;
          const day = sortedDays[index];
          setAthleteDate(day.dateOfDay);
          navigate(`/player/${playerId}/summary?type=activity&category=${type}`);
        }
      },
      plugins: { legend: { display: false }, tooltip: { enabled: false, external: handleTooltip } },
      scales: {
        x: {
          grid: { display: false, color: colors.gray[700] },
          ticks: {
            color: colors.slate[500],
            font: { size: 11 },
            callback: (_: unknown, i: number) => {
              const len = sortedDays.length;
              if (len <= 7 || i === 0 || i === len - 1 || (len > 7 && i % 2 === 0))
                return chartData.labels[i];
              return "";
            },
          },
        },
        y: {
          min: 0,
          max: scaleConfig.maxWithPadding,
          border: { display: false },
          grid: { display: true, color: colors.gray[700] },
          ticks: {
            color: colors.slate[500],
            font: { size: 11 },
            stepSize: scaleConfig.stepSize,
            callback: (v: string | number) =>
              typeof v === "number" && v > scaleConfig.max ? "" : v,
          },
        },
      },
    }),
    [
      sortedDays,
      navigate,
      playerId,
      setAthleteDate,
      type,
      handleTooltip,
      scaleConfig,
      chartData.labels,
    ],
  );

  if (!days?.length)
    return (
      <div className="w-full h-[250px] flex items-center justify-center text-slate-500 font-medium">
        {t("evolution.noData")}
      </div>
    );

  return (
    <div className="w-full h-[250px] relative">
      <Line
        key={chartKey}
        data={chartData}
        options={options}
        plugins={[backgroundPlugin, verticalHoverLinePlugin]}
      />
      <CustomTooltip state={tooltipState} />
    </div>
  );
};

const findNearestPreviousIndex = (
  days: Array<{ dateOfDay: string }>,
  targetDateInput: string | Date | null,
): number => {
  if (!days || !days.length || !targetDateInput) return -1;
  const target = dayjs(getSafeIsoDate(targetDateInput));

  for (let i = days.length - 1; i >= 0; i--) {
    const dayDate = dayjs(getSafeIsoDate(days[i].dateOfDay));
    if (dayDate.isSame(target, "day") || dayDate.isBefore(target, "day")) {
      return i;
    }
  }
  return 0;
};

const verticalHoverLinePlugin: Plugin = {
  id: "verticalHoverLine",
  beforeDatasetsDraw(chart) {
    const {
      ctx,
      chartArea: { top, bottom },
    } = chart;
    const active = chart.getActiveElements();
    if (active?.length) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = colors.slate[500];
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.moveTo(active[0].element.x, top);
      ctx.lineTo(active[0].element.x, bottom);
      ctx.stroke();
      ctx.restore();
    }
  },
};

const createGapFillingBackgroundPlugin = (
  events: ChartEvent[],
  days: Array<{ dateOfDay: string }>,
  fillColor: string,
): Plugin => ({
  id: "eventGapBackgrounds",
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!events.length || !days.length) return;

    ctx.save();
    ctx.fillStyle = fillColor;

    events.forEach((evt) => {
      const sIdx = findNearestPreviousIndex(days, evt.startDate);
      const eIdx = findNearestPreviousIndex(days, evt.endDate || new Date());

      if (sIdx === -1) return;

      const startX = scales.x.getPixelForValue(sIdx);
      const endX = scales.x.getPixelForValue(eIdx);

      const top = chartArea.top;
      const bottom = chartArea.bottom;
      const height = bottom - top;

      if (Math.abs(startX - endX) < 1) {
        const width = 24;
        ctx.fillRect(startX - width / 2, top, width, height);
      } else {
        ctx.fillRect(startX, top, endX - startX, height);
      }
    });

    ctx.restore();
  },
});

const CustomTooltip = ({ state }: { state: TooltipState }) => {
  const { t } = useTranslation("player");
  if (state.opacity === 0) return null;

  const activeInjuries = state.activeEvents.filter((e) => e.type === "injury");
  const activeMatches = state.activeEvents.filter((e) => e.type === "match");
  const hasInjuries = activeInjuries.length > 0;
  const hasMatches = activeMatches.length > 0;
  const hasEvents = hasInjuries || hasMatches;
  const currentLang = i18n.language as "fr" | "en";
  return (
    <div
      className="absolute pointer-events-none transition-all duration-200 ease-out z-50"
      style={{
        left: state.left,
        top: state.top,
        transform: "translate(-50%, -100%) translateY(-12px)",
      }}
    >
      <div className="rounded-xl border border-gray-600/50 bg-[#293243] px-4 py-3 pb-2 shadow-xl w-max max-w-[280px]">
        <p className="text-[11px] font-normal text-slate-400 mb-1">
          {dayjs(state.date).format("DD/MM/YYYY")}
        </p>

        {!state.hideScore && <p className="text-lg font-semibold text-gray-50">{state.value}%</p>}

        {hasEvents && (
          <div className={cn(!state.hideScore && "mt-1.5 border-t border-gray-600/50 pt-3")}>
            {hasMatches && (
              <div className={cn(hasInjuries && "mb-3")}>
                <p className="text-xs font-medium text-sky-400 uppercase tracking-wider mt-2 mb-1">
                  {t("evolution.matchLabel", {
                    count: activeMatches.length,
                    defaultValue: "Match",
                  })}
                </p>
              </div>
            )}

            {hasInjuries && (
              <div>
                <p className="text-xs font-medium text-red-500 uppercase tracking-wider mt-2 mb-1">
                  {t("evolution.injuryLabel", { count: activeInjuries.length })}
                </p>
                <div className="flex flex-col gap-2">
                  {activeInjuries.map((ev, idx) => (
                    <div key={idx} className="flex flex-col">
                      <span className="text-sm font-normal text-gray-50">{ev.name}</span>
                      <span className="text-xs text-slate-400 font-normal leading-tight">
                        {dayjs(ev.startDate).locale(currentLang).format("DD MMM")}
                        {" - "}
                        {ev.endDate
                          ? dayjs(ev.endDate).locale(currentLang).format("DD MMM")
                          : "Active"}{" "}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const getSafeIsoDate = (date: string | Date | undefined | null) => {
  if (!date) return "9999-12-31";
  if (typeof date === "string" && date.length >= 10) return date.substring(0, 10);
  return dayjs(date).format("YYYY-MM-DD");
};

const getScaleConfig = (maxValue: number, isInjury: boolean) => {
  if (maxValue < 5) return { max: 10, stepSize: 2, maxWithPadding: 12 };
  if (maxValue < 20) return { max: 30, stepSize: 5, maxWithPadding: 35 };
  if (maxValue < 35 && isInjury) return { max: 50, stepSize: 10, maxWithPadding: 55 };
  return { max: 100, stepSize: 20, maxWithPadding: 120 };
};
