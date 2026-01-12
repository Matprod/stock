import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const currentLanguage = localStorage.getItem("i18nextLng") || "en";
    const language = currentLanguage.toUpperCase();
    config.headers["x-language"] = language;

    try {
      const seasonStorage = localStorage.getItem("season-storage");
      if (seasonStorage) {
        const parsed = JSON.parse(seasonStorage);
        const seasonId = parsed?.state?.selectedSeasonId;
        if (seasonId !== null && seasonId !== undefined) {
          config.headers["x-season-id"] = String(seasonId);
        }
      }
    } catch (error) {
      console.warn("Failed to read season ID from storage:", error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const fetchApi = async <T = unknown>(
  url: string,
  options: RequestInit
): Promise<T> => {
  try {
    const token = localStorage.getItem("token");

    const isFormData = options.body instanceof FormData;

    const headers: Record<string, string> = {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers as Record<string, string>),
    };

    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    const response = await axiosInstance<T>({
      method: options.method,
      url: url,
      headers,
      data: options.body,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(error.response);
    }
    throw error;
  }
};
