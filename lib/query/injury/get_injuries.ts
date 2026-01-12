import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "../../../utils/fetch_api";
import injuryKeys from "./injury.keys";
import type { APIInjury } from "../../../types/player.types";
import { useSeasonStore } from "../../../store/season-store";

const getInjuries = async () => {
  const response = await fetchApi<Array<APIInjury>>("health/injuries", {
    method: "GET",
  });

  return response;
};

export const useGetInjuries = () => {
  const { selectedSeasonId } = useSeasonStore();

  return useQuery({
    queryKey: injuryKeys.list(selectedSeasonId),
    queryFn: () => getInjuries(),
  });
};
