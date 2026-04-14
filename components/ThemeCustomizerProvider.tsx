"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";

export interface ThemeCustomSettings {
  headingFont: string;
  bodyFont: string;
  headingTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  headingStyle: "normal" | "italic";
  primaryColor: string;
  primaryFgColor: string;
  secondaryColor: string;
  secondaryFgColor: string;
  lightForeground: string;
  darkForeground: string;
  iconLibrary: "mdi" | "lucide" | "tabler" | "ph" | "heroicons";
}

export const DEFAULT_THEME_SETTINGS: ThemeCustomSettings = {
  headingFont: "Oswald",
  bodyFont: "Inter",
  headingTransform: "uppercase",
  headingStyle: "normal",
  primaryColor: "#171717",
  primaryFgColor: "#fafafa",
  secondaryColor: "#f5f5f5",
  secondaryFgColor: "#171717",
  lightForeground: "#0a0a0a",
  darkForeground: "#fafafa",
  iconLibrary: "mdi",
};

// ── Icon map: one entry per semantic slot, one icon-id per library ──────────
export const ICON_MAP = {
  logo:       { mdi: "mdi:bullseye",            lucide: "lucide:target",         tabler: "tabler:target",         ph: "ph:crosshair-simple",   heroicons: "heroicons:viewfinder-circle" },
  casual:     { mdi: "mdi:bullseye-arrow",       lucide: "lucide:crosshair",      tabler: "tabler:target-arrow",   ph: "ph:target",             heroicons: "heroicons:cursor-arrow-rays" },
  tournaments:{ mdi: "mdi:trophy",               lucide: "lucide:trophy",         tabler: "tabler:trophy",         ph: "ph:trophy",             heroicons: "heroicons:trophy" },
  liga:       { mdi: "mdi:podium-gold",          lucide: "lucide:bar-chart-2",    tabler: "tabler:podium",         ph: "ph:crown-simple",       heroicons: "heroicons:star" },
  players:    { mdi: "mdi:account-group",        lucide: "lucide:users",          tabler: "tabler:users",          ph: "ph:users",              heroicons: "heroicons:users" },
  standings:  { mdi: "mdi:chart-bar",            lucide: "lucide:bar-chart-2",    tabler: "tabler:chart-bar",      ph: "ph:chart-bar",          heroicons: "heroicons:chart-bar" },
  seasons:    { mdi: "mdi:calendar-range",       lucide: "lucide:calendar-range", tabler: "tabler:calendar-stats", ph: "ph:calendar",           heroicons: "heroicons:calendar" },
  settings:   { mdi: "mdi:cog",                  lucide: "lucide:settings",       tabler: "tabler:settings",       ph: "ph:gear",               heroicons: "heroicons:cog-6-tooth" },
  account:    { mdi: "mdi:account",              lucide: "lucide:user",           tabler: "tabler:user",           ph: "ph:user",               heroicons: "heroicons:user" },
  signout:    { mdi: "mdi:logout",               lucide: "lucide:log-out",        tabler: "tabler:logout",         ph: "ph:sign-out",           heroicons: "heroicons:arrow-right-on-rectangle" },
} satisfies Record<string, Record<ThemeCustomSettings["iconLibrary"], string>>;

export type IconKey = keyof typeof ICON_MAP;

export function useAppIcon() {
  const { settings } = useThemeCustomizer();
  return (key: IconKey): string =>
    ICON_MAP[key][settings.iconLibrary] ?? ICON_MAP[key].mdi;
}

export const GOOGLE_FONTS: { name: string; category: string }[] = [
  { name: "Inter",             category: "sans-serif" },
  { name: "Roboto",            category: "sans-serif" },
  { name: "Open Sans",         category: "sans-serif" },
  { name: "Poppins",           category: "sans-serif" },
  { name: "Montserrat",        category: "sans-serif" },
  { name: "Lato",              category: "sans-serif" },
  { name: "Nunito",            category: "sans-serif" },
  { name: "Raleway",           category: "sans-serif" },
  { name: "DM Sans",           category: "sans-serif" },
  { name: "Space Grotesk",     category: "sans-serif" },
  { name: "Oswald",            category: "sans-serif" },
  { name: "Exo 2",             category: "sans-serif" },
  { name: "Playfair Display",  category: "serif" },
  { name: "Merriweather",      category: "serif" },
  { name: "PT Serif",          category: "serif" },
  { name: "Libre Baskerville", category: "serif" },
];

export const ICON_LIBRARIES: {
  id: ThemeCustomSettings["iconLibrary"];
  name: string;
  prefix: string;
  url: string;
  preview: string[];
}[] = [
  {
    id: "mdi",
    name: "Material Design Icons",
    prefix: "mdi",
    url: "https://pictogrammers.com/libraries/mdi/",
    preview: [
      "mdi:trophy", "mdi:account", "mdi:bullseye", "mdi:bullseye-arrow",
      "mdi:calendar", "mdi:cog", "mdi:home", "mdi:chart-bar",
      "mdi:plus-circle", "mdi:delete", "mdi:pencil", "mdi:check-circle",
    ],
  },
  {
    id: "lucide",
    name: "Lucide Icons",
    prefix: "lucide",
    url: "https://lucide.dev/icons/",
    preview: [
      "lucide:trophy", "lucide:user", "lucide:target", "lucide:crosshair",
      "lucide:calendar", "lucide:settings", "lucide:home", "lucide:bar-chart-2",
      "lucide:plus-circle", "lucide:trash-2", "lucide:pencil", "lucide:check-circle",
    ],
  },
  {
    id: "tabler",
    name: "Tabler Icons",
    prefix: "tabler",
    url: "https://tabler.io/icons",
    preview: [
      "tabler:trophy", "tabler:user", "tabler:target", "tabler:target-arrow",
      "tabler:calendar", "tabler:settings", "tabler:home", "tabler:chart-bar",
      "tabler:circle-plus", "tabler:trash", "tabler:pencil", "tabler:circle-check",
    ],
  },
  {
    id: "ph",
    name: "Phosphor Icons",
    prefix: "ph",
    url: "https://phosphoricons.com/",
    preview: [
      "ph:trophy", "ph:user", "ph:crosshair-simple", "ph:target",
      "ph:calendar", "ph:gear", "ph:house", "ph:chart-bar",
      "ph:plus-circle", "ph:trash", "ph:pencil", "ph:check-circle",
    ],
  },
  {
    id: "heroicons",
    name: "Heroicons",
    prefix: "heroicons",
    url: "https://heroicons.com/",
    preview: [
      "heroicons:trophy", "heroicons:user", "heroicons:viewfinder-circle", "heroicons:cursor-arrow-rays",
      "heroicons:calendar", "heroicons:cog-6-tooth", "heroicons:home", "heroicons:chart-bar",
      "heroicons:plus-circle", "heroicons:trash", "heroicons:pencil", "heroicons:check-circle",
    ],
  },
];

// ── Provider internals ───────────────────────────────────────────────────────

const STORAGE_KEY = "dart-theme-customizer";

interface ThemeCustomizerContextType {
  settings: ThemeCustomSettings;
  updateSettings: (partial: Partial<ThemeCustomSettings>) => void;
  resetSettings: () => void;
}

const ThemeCustomizerContext = createContext<ThemeCustomizerContextType>({
  settings: DEFAULT_THEME_SETTINGS,
  updateSettings: () => {},
  resetSettings: () => {},
});

export function useThemeCustomizer() {
  return useContext(ThemeCustomizerContext);
}

function injectGoogleFont(fontName: string, linkId: string) {
  if (typeof document === "undefined") return;
  const slug = fontName.replace(/ /g, "+");
  const href = `https://fonts.googleapis.com/css2?family=${slug}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap`;
  const existing = document.getElementById(linkId) as HTMLLinkElement | null;
  if (existing) {
    existing.href = href;
  } else {
    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

function applyThemeToDOM(s: ThemeCustomSettings) {
  if (typeof document === "undefined") return;

  injectGoogleFont(s.headingFont, "theme-heading-font");
  if (s.bodyFont !== s.headingFont) {
    injectGoogleFont(s.bodyFont, "theme-body-font");
  }

  let style = document.getElementById(
    "theme-customizer-vars",
  ) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "theme-customizer-vars";
    document.head.appendChild(style);
  }

  style.textContent = `
    :root {
      --font-sans: "${s.bodyFont}", system-ui, sans-serif;
      --font-heading: "${s.headingFont}", system-ui, sans-serif;
      --primary: ${s.primaryColor};
      --primary-foreground: ${s.primaryFgColor};
      --secondary: ${s.secondaryColor};
      --secondary-foreground: ${s.secondaryFgColor};
      --foreground: ${s.lightForeground};
    }
    .dark {
      --font-sans: "${s.bodyFont}", system-ui, sans-serif;
      --font-heading: "${s.headingFont}", system-ui, sans-serif;
      --primary: ${s.primaryColor};
      --primary-foreground: ${s.primaryFgColor};
      --foreground: ${s.darkForeground};
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: var(--font-heading, var(--font-sans));
      text-transform: ${s.headingTransform};
      font-style: ${s.headingStyle};
      font-weight: 500;
    }
  `;
}

function clearThemeFromDOM() {
  if (typeof document === "undefined") return;
  const style = document.getElementById("theme-customizer-vars");
  if (style) style.textContent = "";
}

export function ThemeCustomizerProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] =
    useState<ThemeCustomSettings>(DEFAULT_THEME_SETTINGS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Partial<ThemeCustomSettings> = JSON.parse(stored);
        setSettings({ ...DEFAULT_THEME_SETTINGS, ...parsed });
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyThemeToDOM(settings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings, mounted]);

  const updateSettings = useCallback(
    (partial: Partial<ThemeCustomSettings>) => {
      setSettings((prev) => ({ ...prev, ...partial }));
    },
    [],
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_THEME_SETTINGS);
    clearThemeFromDOM();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return (
    <ThemeCustomizerContext.Provider
      value={{ settings, updateSettings, resetSettings }}
    >
      {children}
    </ThemeCustomizerContext.Provider>
  );
}
