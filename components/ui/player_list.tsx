"use client";

import { ArrowRight, InfoIcon } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { getPlayerPicture } from "../player/player_card";
import type { IPlayer } from "../../types/player.types";
import { useDateStore } from "../../store/date-store";

interface PlayerListProps {
  team: IPlayer[];
  title: string;
  threshold: number;
  valueKey: "finalScore" | "injuryScore";
  valueColor: string;
  valueLabel: string;
  limit?: number;
  sortOrder?: "asc" | "desc";
  date?: string;
  info: string;
}

export default function PlayerList({
  team,
  title,
  threshold,
  valueKey,
  valueColor,
  valueLabel,
  limit,
  sortOrder = "asc",
  date,
  info,
}: PlayerListProps) {
  const players = useMemo(() => {
    return team
      .map((player) => {
        const latestDay = player.days
          .filter((day) => day[valueKey] && (!date || day.dateOfDay === date))
          .sort((a, b) => new Date(b.dateOfDay).getTime() - new Date(a.dateOfDay).getTime())[0];

        if (!latestDay?.[valueKey]) return null;

        const value = latestDay[valueKey];

        return {
          id: player.id,
          name: player.name,
          value,
          player, // Keep reference to original player object
        };
      })
      .filter(
        (player): player is NonNullable<typeof player> =>
          player !== null && (threshold === 0 || player.value >= threshold),
      )
      .sort((a, b) => (sortOrder === "desc" ? b.value - a.value : a.value - b.value))
      .slice(0, limit);
  }, [team, threshold, valueKey, sortOrder, limit, date]);

  const { teamDate, setAthleteDate } = useDateStore();

  // if (players.length === 0) return null;

  return (
    <div className="card w-full bg-[#252d3b] rounded-3xl border border-[#3a4454] p-6">
      <h2 className="text-xl font-medium text-gray-100 mb-4 flex items-center gap-x-2">
        {title}
        <div className="group relative">
          <InfoIcon className="w-4 h-4 text-gray-400 hover:text-gray-400 cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#142836fc] text-gray-100 text-xs rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-normal z-10 w-[220px] shadow-lg">
            {info}
          </div>
        </div>
      </h2>
      <div className="space-y-4 max-h-[450px] overflow-y-auto pr-4">
        {players.map((player) => (
          <PlayerListItem
            key={player.id}
            player={{
              id: player.id,
              name: player.name,
              profilePicture: player.player.profilePicture,
              value: player.value,
            }}
            valueColor={valueColor}
            valueLabel={valueLabel}
            onClick={() => {
              if (teamDate) {
                setAthleteDate(teamDate);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

export const PlayerListItem = ({
  player,
  valueColor,
  valueLabel,
  onClick,
}: {
  player: Pick<IPlayer, "id" | "name" | "profilePicture"> & {
    value?: number;
  };
  valueColor: string;
  valueLabel: string;
  onClick?: () => void;
}) => (
  <Link
    key={player.id}
    to={`/player/${player.id}`}
    className="flex items-center justify-between p-3 rounded-xl hover:bg-[#323d56] transition-colors border border-[#3a4454]"
    onClick={onClick}
  >
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#3a4454]">
        <img
          src={getPlayerPicture(player)}
          alt={player.name}
          className="object-cover w-full h-full"
        />
      </div>
      <div>
        <p className="font-medium text-blue-200">{player.name}</p>
        <p className={`text-sm font-medium ${valueColor}`}>
          {player.value ? `${Math.round(player.value)}% ${valueLabel}` : valueLabel}
        </p>
      </div>
    </div>
    <ArrowRight className="w-5 h-5 text-white" />
  </Link>
);
