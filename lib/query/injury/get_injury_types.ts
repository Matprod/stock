import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "../../../utils/fetch_api";
import type { InjuryType } from "../../../types/injury.types";

const getInjuryTypes = async () => {
  const response = await fetchApi<Array<InjuryType>>("health/injuries/types", {
    method: "GET",
  });

  return response;
};

export const useGetInjuryTypes = () => {
  return useQuery({
    queryKey: ["injury-types"],
    queryFn: () => getInjuryTypes(),
  });
};
