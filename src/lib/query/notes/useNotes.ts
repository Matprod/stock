import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "../../../utils/fetch_api";
import notesKeys from "./notes.keys";
import type { INoteWithAthlete } from "../../../types/notes";
import { useSeasonStore } from "../../../store/season-store";

const getAllNotes = async () => {
  const response = await fetchApi<INoteWithAthlete[]>("notes", {
    method: "GET",
  });
  return response;
};

export const useGetNotes = () => {
  const { selectedSeasonId } = useSeasonStore();

  return useQuery({
    queryKey: notesKeys.list(selectedSeasonId),
    queryFn: getAllNotes,
  });
};

const addNote = async (data: { athleteId: number; content: string; noteDate: string }) => {
  const response = await fetchApi<INoteWithAthlete>("notes", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return response;
};

export const useAddNote = () => {
  const queryClient = useQueryClient();
  const { selectedSeasonId } = useSeasonStore();

  return useMutation({
    mutationFn: addNote,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: notesKeys.list(selectedSeasonId),
      });
    },
  });
};

const updateNote = async ({ noteId, data }: { noteId: number; data: { content: string } }) => {
  const response = await fetchApi<INoteWithAthlete>(`notes/${noteId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return response;
};

export const useUpdateNote = () => {
  const queryClient = useQueryClient();
  const { selectedSeasonId } = useSeasonStore();

  return useMutation({
    mutationFn: updateNote,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: notesKeys.list(selectedSeasonId),
      });
    },
  });
};

const deleteNote = async ({ noteId }: { noteId: number }) => {
  await fetchApi(`notes/${noteId}`, {
    method: "DELETE",
  });
};

export const useDeleteNote = () => {
  const queryClient = useQueryClient();
  const { selectedSeasonId } = useSeasonStore();

  return useMutation({
    mutationFn: deleteNote,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: notesKeys.list(selectedSeasonId),
      });
    },
  });
};
