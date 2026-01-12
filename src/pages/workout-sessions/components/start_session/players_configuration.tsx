import { FormLabel } from "../../../../components/ui/form";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverTrigger, PopoverContent } from "@radix-ui/react-popover";
import { Button } from "../../../../components/ui/button";
import { ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "../../../../components/ui/command";
import { Check } from "lucide-react";
import { useFormContext } from "react-hook-form";
import type { WorkoutSessionData } from "../../schemas/workout_schema";
import { useState } from "react";
import useGetAthletes from "../../../../lib/query/athletes/get_athletes";

const PlayersConfiguration = () => {
  const { t } = useTranslation("workout");
  const {
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<WorkoutSessionData>();
  const [playersOpen, setPlayersOpen] = useState(false);
  const { data: players } = useGetAthletes();

  const selectedPlayers = watch("players");

  const togglePlayer = (playerId: number) => {
    const currentPlayers = getValues("players");
    const updatedPlayers = currentPlayers.includes(playerId)
      ? currentPlayers.filter((id) => id !== playerId)
      : [...currentPlayers, playerId];
    setValue("players", updatedPlayers);
  };

  return (
    <div className="space-y-2 pt-4">
      <FormLabel className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        {t("player.participants")}
      </FormLabel>
      <Popover open={playersOpen} onOpenChange={setPlayersOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={playersOpen}
            className="w-full justify-between"
          >
            {t("player.selected", { count: selectedPlayers.length })}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 bg-background border rounded-md shadow-md z-50"
          align="start"
        >
          <Command className="rounded-md border shadow-md bg-primary">
            <CommandInput placeholder={t("player.searchPlaceholder")} />
            <CommandList>
              <CommandEmpty>{t("player.noneFound")}</CommandEmpty>
              <CommandGroup>
                {(players ?? []).map((player) => (
                  <CommandItem
                    key={player.id}
                    onSelect={() => {
                      togglePlayer(player.id);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${
                        selectedPlayers.includes(player.id) ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    {player.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {errors.players && (
        <p className="text-sm font-medium text-destructive">{errors.players.message}</p>
      )}
    </div>
  );
};

export default PlayersConfiguration;
