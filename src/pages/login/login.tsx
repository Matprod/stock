import { SignInForm } from "./components/signin_form";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Globe } from "lucide-react";

const LoginPage = () => {
  const { t, i18n } = useTranslation("login");
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  const words = useMemo(
    () => [
      t("hero.words.performance"),
      t("hero.words.injury_risk"),
      t("hero.words.nutrition"),
      t("hero.words.sleep_health"),
    ],
    [t],
  );

  const [currentWord, setCurrentWord] = useState(words[0]);
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [words.length]);

  useEffect(() => {
    setCurrentWord(words[wordIndex]);
  }, [wordIndex, words]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setIsLanguageMenuOpen(false);
  };

  const handleMouseEnter = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setIsLanguageMenuOpen(true);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setIsLanguageMenuOpen(false);
    }, 150); // Petit délai pour permettre de naviguer vers le menu
    setHoverTimeout(timeout);
  };

  const getCurrentLanguageCode = () => {
    return i18n.language === "en" ? "EN" : "FR";
  };

  return (
    <div className="fixed top-0 left-0 w-screen h-screen overflow-hidden flex bg-[#28223a]">
      {/* Language Selector - Bottom Left */}
      <div className="fixed bottom-6 left-6 z-50">
        <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="relative">
          <Button
            variant="outline"
            className="bg-[#3b2f56] border-white/20 text-white hover:bg-[#4f4f7c] hover:text-white transition-colors flex items-center gap-2"
          >
            <Globe className="w-4 h-4" />
            <span className="text-sm font-semibold bg-white/20 px-2 py-1 rounded">
              {getCurrentLanguageCode()}
            </span>
          </Button>

          {/* Language Menu Dropdown */}
          {isLanguageMenuOpen && (
            <div
              className="absolute bottom-full left-0 mb-2 w-full min-w-[160px] bg-[#3b2f56] border border-white/20 rounded-lg shadow-lg overflow-hidden"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => changeLanguage("en")}
                type="button"
                className={`w-full px-4 py-3 text-left text-white hover:bg-[#4f4f7c] transition-colors flex items-center gap-3 ${
                  i18n.language === "en" ? "bg-[#4f4f7c]" : ""
                }`}
              >
                <span className="text-sm font-semibold bg-white/20 px-2 py-1 rounded">EN</span>
                <span>{t("language_selector.english")}</span>
              </button>
              <button
                onClick={() => changeLanguage("fr")}
                type="button"
                className={`w-full px-4 py-3 text-left text-white hover:bg-[#4f4f7c] transition-colors flex items-center gap-3 ${
                  i18n.language === "fr" ? "bg-[#4f4f7c]" : ""
                }`}
              >
                <span className="text-sm font-semibold bg-white/20 px-2 py-1 rounded">FR</span>
                <span>{t("language_selector.french")}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Language Indicator - Bottom Right */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-[#3b2f56] border border-white/20 text-white px-3 py-2 rounded-lg">
          <span className="text-sm font-semibold">{i18n.language.toUpperCase()}</span>
        </div>
      </div>

      <div className="hidden md:flex flex-col justify-center w-1/2 bg-[#28223a] relative">
        <div className="absolute left-0 top-0 h-full w-2 bg-gradient-to-b from-[#a78bfa] to-[#6366f1] rounded-r-xl" />
        <div className="pl-20 pr-8 py-16 flex flex-col gap-4">
          <h2 className="text-[4rem] leading-[4.5rem] font-extrabold text-white mb-2 drop-shadow-lg">
            {t("hero.monitor")}
            <br />
            {currentWord}
          </h2>
          <h3 className="text-[2.5rem] leading-[3rem] font-bold text-[#a78bfa] drop-shadow">
            {t("hero.with_mauna")}
          </h3>
        </div>
      </div>

      <div className="flex flex-col justify-center items-center w-full md:w-1/2 bg-[#28223a] px-8">
        <div className="w-full max-w-md">
          <h1 className="text-4xl font-bold text-white mb-8">{t("title")}</h1>
          <SignInForm />
          <div className="flex items-center my-6">
            <div className="flex-grow h-px bg-white/20" />
            <span className="mx-4 text-white/50">{t("divider")}</span>
            <div className="flex-grow h-px bg-white/20" />
          </div>
          <div className="flex gap-4">
            <a
              href="https://calendly.com/gaspard-espitallier/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 border border-white/20 rounded-lg py-2 text-white hover:bg-white/10 transition"
            >
              {t("calendly")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
