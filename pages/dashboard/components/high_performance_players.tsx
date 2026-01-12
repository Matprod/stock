"use client";

import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { getPlayerPicture } from "../../../components/player/player_card";
import type { IPlayer } from "../../../types/player.types";

interface HighPerformancePlayersProps {
  team: IPlayer[];
}

export default function HighPerformancePlayers({
  team,
}: HighPerformancePlayersProps) {
  const highPerformancePlayers = useMemo(() => {
    return team
      .map((player) => {
        const latestDay = player.days
          .filter((day) => day.finalScore)
          .sort(
            (a, b) =>
              new Date(b.dateOfDay).getTime() - new Date(a.dateOfDay).getTime()
          )[0];

        if (!latestDay?.finalScore) return null;

        const performance = latestDay.finalScore;

        return {
          id: player.id,
          name: player.name,
          performance,
          player, // Keep reference to original player object
        };
      })
      .filter(
        (player): player is NonNullable<typeof player> =>
          player !== null && player.performance >= 70
      )
      .sort((a, b) => b.performance - a.performance);
  }, [team]);

  if (highPerformancePlayers.length === 0) return null;

  return (
    <div className="card w-full p-6">
      <h2 className="text-lg font-semibold text-white mb-4">
        Today players with High Performance
      </h2>
      <div className="space-y-4">
        {highPerformancePlayers.map((player) => (
          <Link
            key={player.id}
            to={`/player/${player.id}`}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-gray-100">
                <img
                  src={getPlayerPicture(player)}
                  alt={player.name}
                  className="object-cover w-full h-full"
                />
              </div>
              <div>
                <p className="font-medium text-white">{player.name}</p>
                <p className="text-sm font-medium text-green-500">
                  {Math.round(player.performance)}% performance
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-white" />
          </Link>
        ))}
      </div>
    </div>
  );
}
