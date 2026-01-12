import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Plus } from "lucide-react";
import { UpsertInjury } from "./components/upsert_injury";
import InjuryList from "./components/injury_list";
import type { APIInjury } from "../../types/player.types";

export const PlayerInjuriesPage: FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [injury, setInjury] = useState<APIInjury | null>(null);
  const { t } = useTranslation("injury");

  return (
    <div className="h-full">
      <div className="mb-6">
        <h1 className="font-medium text-4xl text-center text-white-400 pb-4">{t("title")}</h1>
        <p className="text-gray-300 text-center">{t("subtitle")}</p>
      </div>

      <div className="rounded-3xl p-4 h-full">
        <Dialog
          open={isModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setInjury(null);
            }
            setIsModalOpen(open);
          }}
        >
          <DialogTrigger asChild>
            <div className="flex items-center justify-end mb-4 w-fit ml-auto">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4" />
                {t("addInjury")}
              </Button>
            </div>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl">{t("addInjury")}</DialogTitle>
            </DialogHeader>
            <UpsertInjury
              setIsOpen={setIsModalOpen}
              injury={injury}
              onClose={() => setInjury(null)}
            />
          </DialogContent>
        </Dialog>

        <InjuryList setInjury={setInjury} setIsModalOpen={setIsModalOpen} />
      </div>
    </div>
  );
};
