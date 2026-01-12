export const SUPPORTED_LANGUAGES = {
  en: "En",
  fr: "Fr",
} as const;
export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;
export interface MultilingualName {
  id: number;
  nameEn?: string | null;
  nameFr?: string | null;
}

export const getLocalizedName = (
  item: { nameFr?: string | null; nameEn?: string | null },
  lang: SupportedLanguage,
): string => {
  const propertyName = `name${SUPPORTED_LANGUAGES[lang]}` as keyof typeof item;
  return (item[propertyName] as string) || "";
};

export const getSupportedLanguage = (language: string): SupportedLanguage => {
  const lang = language.split("-")[0] as SupportedLanguage;
  return lang in SUPPORTED_LANGUAGES ? lang : "en";
};
