import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "../../../utils/fetch_api";
import injuryKeys from "./injury.keys";
import type { UpsertInjurySchema } from "../../../pages/player_injuries/schemas/upsert_injury_schema";

const upsertInjury = async (
  data: Omit<UpsertInjurySchema, "startDate" | "endDate"> & { startDate: string; endDate?: string },
) => {
  const response = await fetchApi(`health/injuries${data.id ? `/${data.id}` : ""}`, {
    method: data.id ? "PUT" : "POST",
    body: JSON.stringify(data),
  });
  return response;
};

export const useUpsertInjury = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: upsertInjury,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: injuryKeys.lists() });
    },
  });
};
