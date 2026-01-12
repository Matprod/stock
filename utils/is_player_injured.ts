import dayjs, { type Dayjs } from "dayjs";
import type { APIInjury, IPlayer } from "../types/player.types";

export const isPlayerInjured = (injuries: APIInjury[], date: Dayjs | string) => {
  return injuries.some((injury) => {
    const injuryDate = dayjs(injury.dateOfInjury);
    const recoveryDate = dayjs(injury.recoveryDate);
    return (
      injuryDate.isSameOrBefore(date) && (recoveryDate.isSameOrAfter(date) || !injury.recoveryDate)
    );
  });
};

export const getPlayerCurrentInjury = (
  player: IPlayer,
  date: Dayjs | string,
): APIInjury | undefined => {
  return player.injuries.find((injury) => {
    const injuryDate = dayjs(injury.dateOfInjury);
    const recoveryDate = dayjs(injury.recoveryDate);
    return (
      injuryDate.isSameOrBefore(date) && (recoveryDate.isSameOrAfter(date) || !injury.recoveryDate)
    );
  });
};
