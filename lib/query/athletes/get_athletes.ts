import { useQuery } from "@tanstack/react-query";
import type { ITeamOverviewPlayer } from "../../../types/player.types";
import { fetchApi } from "../../../utils/fetch_api";
import athletesKeys from "./athletes.keys";
import { useSeasonStore } from "../../../store/season-store";

const getAthletes = async () => {
  const response = await fetchApi<ITeamOverviewPlayer[]>("athletes/team-list", {
    method: "GET",
  });

  return response;
};

const useGetAthletes = () => {
  const { selectedSeasonId } = useSeasonStore();

  return useQuery({
    queryKey: athletesKeys.list(selectedSeasonId),
    queryFn: getAthletes,
  });
};

export default useGetAthletes;
