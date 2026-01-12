import { LogOut } from "lucide-react";
import { FaUsers, FaUserInjured } from "react-icons/fa";
import { PiSpeedometer } from "react-icons/pi";
import { MdOutlineStickyNote2 } from "react-icons/md";
import { GiWeightLiftingUp } from "react-icons/gi";
import { useTranslation } from "react-i18next";
import { fetchApi } from "../utils/fetch_api";
import { SideBarItem } from "./side_bar_item";
import { Button } from "./ui/button";
import { twMerge } from "tailwind-merge";
import { FR, GB } from "country-flag-icons/react/3x2";
import useGetAthletes from "../lib/query/athletes/get_athletes";
import { getPlayerPicture } from "./player/player_card";
import { Link } from "react-router-dom";
import { Skeleton } from "./ui/skeleton";
import dayjs from "dayjs";

import { queryClient } from "../lib/query/queryClient";
import insightsKeys from "../lib/query/insights/insights.keys";
import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import athletesKeys from "../lib/query/athletes/athletes.keys";
import { useHoverWithDelay } from "../hooks/useHoverWithDelay";
import { useDemoStore } from "../store/demo-store";
import { useDateStore } from "../store/date-store";
import { SeasonSelector } from "./season_selector";
import useGetSeasons from "../lib/query/seasons/get_seasons";

const CLUB_SUNDERLAND_ID = 9;

const TeamListPopoverPreview = () => {
  const { data: teamData, isLoading } = useGetAthletes();
  const { isDemo } = useDemoStore();
  const { setAthleteDate } = useDateStore();
  const players = (teamData ?? [])
    .map((player) => {
      const latestDay = player.days
        .filter((day) => day.finalScore !== undefined && day.finalScore !== null)
        .filter((day) => dayjs(day.dateOfDay).isBefore(dayjs(), "day"))
        .sort((a, b) => new Date(b.dateOfDay).getTime() - new Date(a.dateOfDay).getTime())[0];
      return {
        id: player.id,
        name: player.name,
        position: player.playerPosition?.name,
        performance:
          latestDay?.finalScore !== undefined && latestDay?.finalScore !== null
            ? Math.round(latestDay?.finalScore)
            : null,
        injury:
          latestDay?.injuryScore !== undefined && latestDay?.injuryScore !== null
            ? Math.round(latestDay?.injuryScore)
            : null,
        player, // Keep reference to original player object
      };
    })
    .filter((player) => !(isDemo && player.performance === 0))
    .sort((a, b) => (b.performance ?? 0) - (a.performance ?? 0));

  if (isLoading) {
    return (
      <div className="p-4 bg-[#252d3b] w-full h-[400px]">
        <div className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#252d3b] border border-[#3a4454] rounded-2xl w-full">
      <div className="font-medium text-xl mb-2 text-gray-100">Team Preview</div>
      <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
        {players.map((player) => {
          const handlePlayerClick = () => {
            const latestDay = player.player.days
              .filter((day) => day.finalScore !== undefined && day.finalScore !== null)
              .filter((day) => dayjs(day.dateOfDay).isBefore(dayjs(), "day"))
              .sort((a, b) => new Date(b.dateOfDay).getTime() - new Date(a.dateOfDay).getTime())[0];

            if (latestDay?.dateOfDay) {
              setAthleteDate(latestDay.dateOfDay);
            }
          };

          return (
            <Link
              key={player.id}
              to={`/player/${player.id}`}
              onClick={handlePlayerClick}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#232b3a] transition-colors"
            >
              <img
                src={getPlayerPicture({
                  id: player.id,
                  profilePicture: player.player.profilePicture,
                })}
                alt={player.name}
                className="w-10 h-10 rounded-full object-cover border border-[#3a4454]"
              />
              <div className="flex-1 min-w-0">
                <div className="text-blue-200 font-medium truncate">{player.name}</div>
                <div className="text-xs text-blue-100 truncate">{player.position}</div>
              </div>
              <div className="flex flex-col items-end min-w-[48px]">
                <span className="text-green-400 text-xs font-semibold">
                  {`${player.performance ?? "-"}%`}
                  {/* {player.performance > 0 ? player.performance + "%" : "-"} */}
                </span>
                <span className="text-red-400 text-xs font-semibold">
                  {`${player.injury === 0 ? 1 : (player.injury ?? "-")}%`}
                  {/* {player.injury > 0 ? player.injury + "%" : "-"} */}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="mt-2 text-right">
        <Link to="/" className="text-xs text-blue-300 hover:underline">
          View full team
        </Link>
      </div>
    </div>
  );
};

const languages = [
  {
    code: "fr",
    label: "Français",
    icon: <FR className="w-6 h-6 rounded-full" />,
  },
  {
    code: "en",
    label: "English",
    icon: <GB className="w-6 h-6 rounded-full" />,
  },
];

const LanguagePopover = ({
  current,
  onChange,
}: {
  current: string;
  onChange: (lang: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const { handleMouseEnter, handleMouseLeave } = useHoverWithDelay(
    () => setOpen(true),
    () => setOpen(false),
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          className="w-10 h-10 rounded-full border border-white/20 shadow flex items-center justify-center bg-primary/80 hover:text-light-primary hover:bg-white/10 transition-all font-medium text-blue-100 text-base select-none"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {current === "en" ? "EN" : "FR"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="center"
        sideOffset={8}
        className="p-2 bg-background-dark-blue min-w-[120px] flex flex-col gap-1"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => onChange(lang.code)}
            className={twMerge(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-all w-full text-left",
              current === lang.code
                ? "bg-blue-500/20 text-blue-200 font-semibold"
                : "hover:bg-white/10 text-blue-100",
            )}
          >
            {lang.icon}
            <span className="ml-2">{lang.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};

export const SideBar = () => {
  const { t, i18n } = useTranslation("sidebar");
  const { data: seasons } = useGetSeasons();

  const clubId = seasons?.[0]?.clubId ?? null;
  const shouldHideWorkoutSessions = clubId === CLUB_SUNDERLAND_ID;

  const handleLogout = async () => {
    await fetchApi("auth/logout", {
      method: "POST",
    });

    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    queryClient.invalidateQueries({ queryKey: insightsKeys.all });
    queryClient.invalidateQueries({ queryKey: athletesKeys.all });
  };

  return (
    <div
      className={twMerge(
        "fixed left-0 top-0 bg-primary pt-8 p-5 flex flex-col items-center z-50 h-screen border-r border-white/10 transition-all duration-300 w-20 shadow-[4px_0_20px_-5px_rgba(0,0,0,0.2)]",
      )}
    >
      <img
        src="/icons/mauna.svg"
        alt="logo"
        width={46}
        height={37}
        className="hover:opacity-80 transition-opacity duration-200"
      />
      <div className="flex flex-col gap-y-4 mt-12 w-full">
        <SideBarItem
          href="/"
          label={t("teamList")}
          icon={<FaUsers size={24} />}
          popoverContent={<TeamListPopoverPreview />}
          popoverOpenOnHover={true}
        />
        <SideBarItem
          href="/dashboard"
          label={t("teamDashboard")}
          icon={<PiSpeedometer size={24} />}
        />
        <SideBarItem href="/notes" label={t("notes")} icon={<MdOutlineStickyNote2 size={24} />} />
        {!shouldHideWorkoutSessions && (
          <SideBarItem
            href="/workout-sessions"
            label={t("workoutSessions")}
            icon={<GiWeightLiftingUp size={24} />}
          />
        )}
        <SideBarItem
          href="/player-injuries"
          label={t("playerInjuries")}
          icon={<FaUserInjured size={24} />}
        />
      </div>
      <div className="mt-auto mb-4 w-full flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2">
          <SeasonSelector />
          <LanguagePopover current={i18n.language} onChange={handleLanguageChange} />
        </div>
        <Button
          className="border border-white/20 rounded-full hover:border-white/40 hover:bg-white/5 font-normal transition-all duration-200 w-10 h-10 p-0 flex items-center justify-center"
          onClick={handleLogout}
        >
          <LogOut size={20} />
        </Button>
      </div>
    </div>
  );
};
