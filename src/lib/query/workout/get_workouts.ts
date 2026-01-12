import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import { fetchApi } from "../../../utils/fetch_api";
import workoutKeys from "./workout.keys";
import type { Workout } from "../../../types/workout.types";
import { useTranslation } from "react-i18next";

const getWorkouts = async () => {
  const response = await fetchApi<Workout[]>("/workouts", {
    method: "GET",
  });

  return response;
};

export const useGetWorkouts = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  const query = useQuery({
    queryKey: workoutKeys.lists(),
    queryFn: () => getWorkouts(),
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        return false;
      }
      return failureCount < 4;
    },
  });

  useEffect(() => {
    if (query.isError) {
      if (axios.isAxiosError(query.error) && query.error.response?.status === 403) {
        toast.error(t("cantAccessToWorkouts"), {
          autoClose: 3500,
          closeOnClick: true,
        });
        navigate("/");
      }
    }
  }, [query.isError, query.error, navigate, t]);

  return query;
};
