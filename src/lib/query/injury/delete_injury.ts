import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "../../../utils/fetch_api";
import injuryKeys from "./injury.keys";

const deleteInjury = async (id: number) => {
  const response = await fetchApi(`health/injuries/${id}`, {
    method: "DELETE",
  });
  return response;
};

export const useDeleteInjury = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteInjury,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: injuryKeys.lists() });
    },
  });
};
