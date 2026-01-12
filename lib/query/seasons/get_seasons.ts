import { useQuery } from "@tanstack/react-query";
import type { ISeason } from "../../../types/player.types";
import { fetchApi } from "../../../utils/fetch_api";
import seasonsKeys from "./seasons.keys";

const getSeasons = async () => {
  const response = await fetchApi<ISeason[]>("athletes/seasons", {
    method: "GET",
  });

  return response;
};

const useGetSeasons = () => {
  return useQuery({
    queryKey: seasonsKeys.all(),
    queryFn: getSeasons,
  });
};

export default useGetSeasons;


