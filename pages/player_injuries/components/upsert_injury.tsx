import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { APIInjury, InjuryContext } from "../../../types/player.types";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { type UpsertInjurySchema, upsertInjurySchema } from "../schemas/upsert_injury_schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "../../../components/ui/form";
import { Button } from "../../../components/ui/button";
import useGetAthletes from "../../../lib/query/athletes/get_athletes";
import { useGetInjuryTypes } from "../../../lib/query/injury/get_injury_types";
import { SelectRhf } from "../../../components/forms/select_rhf";
import { DateInputRhf } from "../../../components/forms/date_input_rhf";
import { TextareaRhf } from "../../../components/forms/textarea_rhf";
import { useUpsertInjury } from "../../../lib/query/injury/upsert_injury";
import dayjs from "dayjs";
import { getLocalizedName, getSupportedLanguage } from "../../../utils/language_config";

interface UpsertInjuryProps {
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  injury?: APIInjury | null;
  onClose: () => void;
}

export const UpsertInjury = ({ injury, setIsOpen, onClose }: UpsertInjuryProps) => {
  const { t, i18n } = useTranslation("injury");
  const currentLanguage = getSupportedLanguage(i18n.language);
  const { data: players = [] } = useGetAthletes();
  const { data: injuryTypes = [] } = useGetInjuryTypes();
  const { mutate: upsertInjuryMutation } = useUpsertInjury();
  const form = useForm<UpsertInjurySchema>({
    resolver: zodResolver(upsertInjurySchema),
    defaultValues: {
      athleteId: injury ? injury.athleteId : undefined,
      injuryTypeId: injury ? injury.injuryType.id : undefined,
      startDate: injury ? dayjs(injury.dateOfInjury).toDate() : undefined,
      endDate: injury?.recoveryDate ? dayjs(injury.recoveryDate).toDate() : undefined,
      context: injury?.context ?? undefined,
      note: injury?.note ?? "",
    },
  });
  const { control, handleSubmit } = form;

  const onSubmit = (data: UpsertInjurySchema) => {
    const startDateDay = dayjs(data.startDate).format("YYYY-MM-DD");
    const endDateDay = data.endDate ? dayjs(data.endDate).format("YYYY-MM-DD") : undefined;

    upsertInjuryMutation({
      ...data,
      id: injury?.id,
      startDate: startDateDay,
      endDate: endDateDay,
      context: data.context || undefined,
      note: data.note?.trim() || undefined,
    });
    onClose();
    setIsOpen(false);
  };

  const sortedInjuryTypes = useMemo(() => {
    return [...injuryTypes].sort((a, b) => {
      return getLocalizedName(a, currentLanguage).localeCompare(
        getLocalizedName(b, currentLanguage),
      );
    });
  }, [injuryTypes, currentLanguage]);

  const contextOptions: Array<{ value: InjuryContext; label: string }> = [
    { value: "match", label: t("match") },
    { value: "training", label: t("training") },
    { value: "other", label: t("other") },
  ];

  return (
    <div className="h-[75vh] bg-background" key={injury?.id}>
      <div className="max-w-2xl mx-auto h-full flex flex-col">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="flex flex-col gap-y-4">
                <SelectRhf
                  className=" w-full"
                  control={control}
                  name="athleteId"
                  label={t("player")}
                  placeholder={t("selectPlayer")}
                  options={players}
                  getOptionLabel={(player) => player.name}
                  getOptionValue={(player) => player.id.toString()}
                />
                <SelectRhf
                  className=" w-full"
                  control={control}
                  name="injuryTypeId"
                  label={t("injuryType")}
                  placeholder={t("selectInjuryType")}
                  options={sortedInjuryTypes}
                  getOptionLabel={(injuryType) => {
                    const typeLabel = getLocalizedName(injuryType, currentLanguage);
                    const categoryLabel = getLocalizedName(injuryType.category, currentLanguage);
                    return `${typeLabel} - (${categoryLabel})`;
                  }}
                  getOptionValue={(injuryType) => injuryType.id.toString()}
                />
                <DateInputRhf
                  control={control}
                  name="startDate"
                  label={t("startDate")}
                  placeholder={t("selectStartDate")}
                />
                <DateInputRhf
                  control={control}
                  name="endDate"
                  label={t("endDate")}
                  placeholder={t("selectEndDate")}
                />
                <SelectRhf
                  className=" w-full"
                  control={control}
                  name="context"
                  label={t("context")}
                  placeholder={t("selectContext")}
                  options={contextOptions}
                  getOptionLabel={(option) => option.label}
                  getOptionValue={(option) => option.value}
                />
                <TextareaRhf
                  className="w-full min-h-[100px] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none max-w-full resize-none"
                  control={control}
                  name="note"
                  label={t("note")}
                  placeholder={t("notePlaceholder")}
                />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex-shrink-0">
              <Button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-primary-foreground"
                size="lg"
              >
                {injury ? t("editInjury") : t("addInjury")}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
