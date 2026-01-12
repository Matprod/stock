import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import axios from "axios";
import type { IPlayer } from "../../../types/player.types";
import { fetchApi } from "../../../utils/fetch_api";
import athletesKeys from "./athletes.keys";
import { useSeasonStore } from "../../../store/season-store";

const getAthlete = async (id: string) => {
  const response = await fetchApi<IPlayer>(`athletes/${id}`, {
    method: "GET",
  });

  return response;
};

export const useGetAthlete = (id?: string) => {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const { selectedSeasonId } = useSeasonStore();

  const query = useQuery({
    enabled: !!id,
    queryKey: athletesKeys.details(id!, selectedSeasonId),
    queryFn: () => getAthlete(id!),
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return false;
      }
      return failureCount < 4;
    },
  });

  useEffect(() => {
    if (query.isError) {
      if (axios.isAxiosError(query.error) && query.error.response?.status === 404) {
        toast.error(t("playerNotInSeason"), {
          autoClose: 3500,
          closeOnClick: true,
        });
      }
      navigate("/");
    }
  }, [query.isError, query.error, navigate, t]);

  return query;
};
