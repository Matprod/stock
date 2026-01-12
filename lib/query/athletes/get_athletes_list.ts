import { useQuery } from "@tanstack/react-query";
import type { IPlayer } from "../../../types/player.types";
import { fetchApi } from "../../../utils/fetch_api";
import athletesKeys from "./athletes.keys";
import { useSeasonStore } from "../../../store/season-store";

const getAthletesList = async () => {
  const response = await fetchApi<IPlayer[]>("athletes", {
    method: "GET",
  });

  return response;
};

export const useGetAthletesList = () => {
  const { selectedSeasonId } = useSeasonStore();

  return useQuery({
    queryKey: athletesKeys.dashboardList(selectedSeasonId),
    queryFn: getAthletesList,
  });
};

