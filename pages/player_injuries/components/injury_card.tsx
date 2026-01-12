import type { FC } from "react";
import { FaCalendarAlt } from "react-icons/fa";
import { getPlayerPicture } from "../../../components/player/player_card";
import type { APIInjury } from "../../../types/player.types";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { useUpsertInjury } from "../../../lib/query/injury/upsert_injury";
import { useDeleteInjury } from "../../../lib/query/injury/delete_injury";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

interface InjuryCardProps {
  injury: APIInjury;
  onEdit: () => void;
  type: "active" | "past";
}

const InjuryCard: FC<InjuryCardProps> = ({ injury, type, onEdit }) => {
  const { t, i18n } = useTranslation("injury");
  const { mutate: updateInjury } = useUpsertInjury();
  const { mutate: deleteInjury } = useDeleteInjury();

  const getContextLabel = (context: APIInjury["context"]) => {
    switch (context) {
      case "match":
        return t("match");
      case "training":
        return t("training");
      default:
        return t("other");
    }
  };

  return (
    <div className="p-3 border rounded-xl hover:bg-[#323d56] transition-colors border-[#3a4454]">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#3a4454] flex-shrink-0">
            <img
              src={getPlayerPicture(injury.athlete)}
              alt={injury.athlete.name}
              className="object-cover w-full h-full"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-blue-200">
              {injury.athlete.name}
              {injury.athlete.playerPosition && (
                <span className="text-gray-500 ml-1">- {injury.athlete.playerPosition?.name}</span>
              )}
            </div>

            <div className="text-sm text-gray-100 mt-1">
              {i18n.language === "fr" ? injury.injuryType.nameFr : injury.injuryType.nameEn}
              {injury.injuryType.category &&
                ` - ${i18n.language === "fr" ? injury.injuryType.category.nameFr : injury.injuryType.category.nameEn}`}
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
              <div className="flex items-center gap-1">
                <FaCalendarAlt size={12} />
                <span>
                  {t("started")}: {dayjs(injury.dateOfInjury).format("DD/MM/YYYY")}
                </span>
              </div>
              {injury.recoveryDate && (
                <div className="flex items-center gap-1">
                  <FaCalendarAlt size={12} />
                  <span>
                    {t("ended")}: {dayjs(injury.recoveryDate).format("DD/MM/YYYY")}
                  </span>
                </div>
              )}
            </div>

            {injury.context && (
              <div className="text-xs text-gray-300 mt-2">
                <span className="font-medium">{t("context")}:</span>&nbsp;
                <span>{getContextLabel(injury.context)}</span>
              </div>
            )}

            {injury.note && (
              <div className="text-xs text-gray-300 mt-2">
                <span className="font-medium">{t("note")}:</span>&nbsp;
                <span className="break-words">{injury.note}</span>
              </div>
            )}

            {type === "active" && (
              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-2">
                Active
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {type === "active" && (
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                const toastId = toast.loading(t("loading"));

                try {
                  await updateInjury({
                    id: injury.id,
                    athleteId: injury.athleteId,
                    injuryTypeId: injury.injuryType.id,
                    startDate: injury.dateOfInjury,
                    endDate: dayjs().format("YYYY-MM-DD"),
                    context: injury.context,
                    note: injury.note,
                  });

                  toast.update(toastId, {
                    render: `${t("injuryRecovered")} ! 🎉`,
                    type: "success",
                    isLoading: false,
                    autoClose: 2500,
                    closeOnClick: true,
                  });
                } catch (error) {
                  toast.update(toastId, {
                    render: t("errorRecoveringInjury"),
                    type: "error",
                    isLoading: false,
                    autoClose: 3500,
                    closeOnClick: true,
                  });
                }
              }}
              className="text-gray-400 hover:text-green-500 transition-colors p-2 text-xs border border-gray-600 rounded hover:bg-gray-700"
              title={t("markAsRecovered")}
            >
              {t("markAsRecovered")}
            </button>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="text-slate-200 hover:text-white hover:bg-white/10 p-2 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              aria-label="Edit injury"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(t("confirmRemove"))) {
                  deleteInjury(injury.id);
                }
              }}
              type="button"
              className="text-slate-200 hover:text-red-400 hover:bg-red-500/20 p-2 rounded"
              aria-label="Remove injury"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InjuryCard;
