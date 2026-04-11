"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Language = "en" | "de";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    "settings.title": "Settings",
    "settings.description": "Manage your app preferences.",
    "settings.appearance": "Appearance",
    "settings.appearance.desc": "Customize how the application looks on your device.",
    "settings.theme": "Theme",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.theme.system": "System",
    "settings.language": "Language",
    "settings.language.desc": "Choose your preferred language for the interface.",
    "settings.language.en": "English",
    "settings.language.de": "Deutsch",
    "nav.tournaments": "Tournaments",
    "nav.players": "Players",
    "nav.standings": "Standings",
    "nav.settings": "Settings",
    "nav.account": "Account",
    "nav.signout": "Sign Out",
  },
  de: {
    "settings.title": "Einstellungen",
    "settings.description": "Verwalten Sie Ihre App-Einstellungen.",
    "settings.appearance": "Erscheinungsbild",
    "settings.appearance.desc": "Passen Sie an, wie die Anwendung auf Ihrem Gerät aussieht.",
    "settings.theme": "Design",
    "settings.theme.light": "Hell",
    "settings.theme.dark": "Dunkel",
    "settings.theme.system": "System",
    "settings.language": "Sprache",
    "settings.language.desc": "Wählen Sie Ihre bevorzugte Sprache für die Benutzeroberfläche.",
    "settings.language.en": "English",
    "settings.language.de": "Deutsch",
    "nav.tournaments": "Turniere",
    "nav.players": "Spieler",
    "nav.standings": "Ranglisten",
    "nav.settings": "Einstellungen",
    "nav.account": "Konto",
    "nav.signout": "Abmelden",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem("app-language") as Language;
    if (savedLang && (savedLang === "en" || savedLang === "de")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLanguageState(savedLang);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app-language", lang);
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
