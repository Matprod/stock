import { ChevronLeftIcon, Upload } from "lucide-react";

import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getPlayerPicture } from "../../components/player/player_card";
import { Stats } from "../../components/stats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Loader } from "../../components/ui/loader";
import { useTranslation } from "react-i18next";
import { useGetAthlete } from "../../lib/query/athletes/get_athlete";
import { useUploadProfilePicture } from "../../lib/query/athletes/upload_profile_picture";
import { useDateStore } from "../../store/date-store";
import { useEffect, useState, useRef, useMemo } from "react";
import dayjs from "dayjs";
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

const PlayerPage = () => {
  const { t } = useTranslation("player");
  const { playerId } = useParams();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("category");
  const [tab, setTab] = useState(tabParam === "injury" ? "injury" : "performance");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTab(tabParam === "injury" ? "injury" : "performance");
  }, [tabParam]);

  const { data: athlete } = useGetAthlete(playerId);
  const { athleteDate } = useDateStore();
  const uploadProfilePictureMutation = useUploadProfilePicture();

  const selectedDay = useMemo(() => {
    if (!athlete || !athleteDate) return null;
    return athlete.days.find((day) => dayjs(day.dateOfDay).isSame(dayjs(athleteDate), "day"));
  }, [athlete, athleteDate]);

  const dayWeight = selectedDay?.weight ?? athlete?.weight;

  const handleProfilePictureClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && playerId) {
      uploadProfilePictureMutation.mutate({
        id: playerId,
        file: file,
      });
    }
  };

  if (!athlete) {
    return <Loader />;
  }

  return (
    <div className="flex flex-col gap-y-8">
      <Link to="/" className="flex flex-row gap-x-2 items-center w-fit">
        <ChevronLeftIcon className="w-8 h-8" />
        <p className="text-2xl font-medium">Team List</p>
      </Link>
      <div className="flex flex-row items-center justify-between w-full">
        <div className="flex items-center gap-x-8">
          <div className="relative">
            <div
              className="p-1 relative w-[150px] h-[150px] border border-[#3a4454] rounded-full cursor-pointer hover:border-blue-400 transition-colors group"
              onClick={handleProfilePictureClick}
            >
              <img
                src={getPlayerPicture(athlete)}
                alt={athlete.name}
                width={150}
                height={150}
                className="rounded-full object-cover w-full h-full"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-full flex items-center justify-center transition-all">
                <Upload className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            {uploadProfilePictureMutation.isPending && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          <h1 className="text-3xl font-medium">{athlete.name}</h1>
        </div>
        <div className="flex flex-col gap-y-1">
          <div className="flex items-center">
            <div className="w-24">
              <span className="text-gray-400">{t("details.age")}:</span>
            </div>
            <div className="w-32">
              <span>
                {athlete.age} {t("details.years")}
              </span>
            </div>
            <div className="w-16 ml-8">
              <span className="text-gray-400">{t("details.height")}:</span>
            </div>
            <div className="w-24">
              <span>{athlete.height} cm</span>
            </div>
            {athlete.jerseyNumber !== undefined && (
              <>
                <div className="w-24">
                  <span className="text-gray-400">{t("details.jerseyNumber")}:</span>
                </div>
                <div className="w-32">
                  <span>#{athlete.jerseyNumber}</span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center">
            <div className="w-24">
              <span className="text-gray-400">{t("details.position")}:</span>
            </div>
            <div className="w-32">
              <span>{athlete.playerPosition?.name}</span>
            </div>
            <div className="w-16 ml-8">
              <span className="text-gray-400">{t("details.weight")}:</span>
            </div>
            <div className="w-24">
              <span>{dayWeight ?? athlete.weight ?? "-"} kg</span>
            </div>
          </div>
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="gap-x-8 mb-4">
          <TabsTrigger value="performance">{t("stats.performance")}</TabsTrigger>
          <TabsTrigger value="injury">{t("stats.injury")}</TabsTrigger>
        </TabsList>
        <TabsContent value="injury">
          <Stats player={athlete} type="injury" />
        </TabsContent>
        <TabsContent value="performance">
          <Stats player={athlete} type="performance" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlayerPage;
