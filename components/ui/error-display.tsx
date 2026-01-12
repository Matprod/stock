import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { BackButton } from "./back-button";

interface ErrorDisplayProps {
  children?: ReactNode;
  errorType?: "loading" | "noData";
  customMessage?: string;
  showBackButton?: boolean;
  backButtonTitle?: string;
}

export const ErrorDisplay = ({
  children,
  errorType = "loading",
  customMessage,
  showBackButton = false,
  backButtonTitle,
}: ErrorDisplayProps) => {
  const { t } = useTranslation("nutrition");

  const getErrorMessage = () => {
    if (customMessage) return customMessage;

    switch (errorType) {
      case "loading":
        return (
          <>
            <h2 className="text-xl font-semibold mb-2">{t("error.loadingError")}</h2>
            <p className="text-sm">{t("error.connectionError")}</p>
          </>
        );
      case "noData":
        return <div className="text-center text-gray-400">{t("noData")}</div>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col items-center gap-y-8">
      {showBackButton && (
        <BackButton title={backButtonTitle || "Retour"} />
      )}
      {children}
      <div className="text-center text-red-400">{getErrorMessage()}</div>
    </div>
  );
};
