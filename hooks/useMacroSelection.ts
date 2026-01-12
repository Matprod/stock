import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { MacronutrientType } from "../types/nutrition.types";
import { MACRO_OPTIONS } from "../types/nutrition.types";

export const useMacroSelection = () => {
  const [searchParams] = useSearchParams();

  const [selectedMacro, setSelectedMacro] = useState<MacronutrientType>(() => {
    const macroFromUrl = searchParams.get("macro") as MacronutrientType;
    return macroFromUrl && MACRO_OPTIONS.includes(macroFromUrl) ? macroFromUrl : "protein";
  });

  useEffect(() => {
    const macroFromUrl = searchParams.get("macro") as MacronutrientType;
    if (macroFromUrl && MACRO_OPTIONS.includes(macroFromUrl)) {
      setSelectedMacro(macroFromUrl);
    }
  }, [searchParams]);

  return { selectedMacro, setSelectedMacro };
};
