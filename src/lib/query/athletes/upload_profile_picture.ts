import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "../../../utils/fetch_api";
import athletesKeys from "./athletes.keys";

const uploadProfilePicture = async (data: { id: string; file: File }) => {
  const formData = new FormData();
  formData.append("profilePicture", data.file);

  const response = await fetchApi(`athletes/${data.id}/profile-picture`, {
    method: "POST",
    body: formData,
    headers: {},
  });

  return response;
};

export const useUploadProfilePicture = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadProfilePicture,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: athletesKeys.details(variables.id),
      });
    },
  });
};
