"use client";

import { useFirebase } from "@/components/FirebaseProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { useAppIcon, useThemeCustomizer } from "@/components/ThemeCustomizerProvider";
import { Icon } from "@iconify/react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { db } from "@/lib/firebase";
import { ChallengeNotification } from "./ChallengeNotification";
import { collection, query, where, onSnapshot } from "firebase/firestore";

interface LigaSidebarItem {
  id: string;
  name: string;
  abbreviation?: string;
  themeColor?: string;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady, isAdmin, logOut } = useFirebase();
  const { t } = useLanguage();
  const getIcon = useAppIcon();
  const { settings } = useThemeCustomizer();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [playerAvatar, setPlayerAvatar] = useState<string>("");
  const [ligen, setLigen] = useState<LigaSidebarItem[]>([]);
  const [ligaExpanded, setLigaExpanded] = useState(true);

  const isMatchPage = pathname?.includes("/match/");

  // Spieler-Avatar für den eingeloggten Nutzer laden
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "players"), where("authUid", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) setPlayerAvatar(snap.docs[0].data().avatar || "");
      else setPlayerAvatar("");
    });
    return () => unsub();
  }, [user]);

  // Load liga list for sidebar
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "liga"));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs
        .map((d) => ({ id: d.id, name: d.data().name, abbreviation: d.data().abbreviation, themeColor: d.data().themeColor }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setLigen(docs);
    });
    return () => unsub();
  }, [user]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">Loading...</div>
    );
  }

  if (!user) return <>{children}</>;

  // Challenge notifications are global (shown on all pages)

  const mainNav = [
    { name: t("nav.tournaments"), href: "/tournaments", iconKey: "tournaments" as const },
    { name: t("nav.casual"),      href: "/casual",      iconKey: "casual"      as const },
    { name: t("nav.players"),     href: "/players",     iconKey: "players"     as const },
  ];

  const bottomNav = [
    { name: t("nav.settings") || "Einstellungen", href: "/settings", iconKey: "settings" as const },
    { name: t("nav.account")  || "Account",        href: "/account",  iconKey: "account"  as const },
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  const iconSize = isCollapsed ? "w-6 h-6" : "w-5 h-5";
  const primary = settings.primaryColor || "#D4AF37";

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <ChallengeNotification />

      {/* ── Desktop Sidebar ── */}
      {!isMatchPage && (
        <aside className={cn(
          "hidden md:flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 relative",
          isCollapsed ? "w-20" : "w-64",
        )}>
          {/* Logo */}
          <div className={cn("p-6 flex items-center", isCollapsed ? "justify-center px-0" : "justify-between")}>
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logoUrl}
                alt="Logo"
                className={cn("object-contain", isCollapsed ? "w-10 h-10" : "h-9 max-w-[160px]")}
              />
            ) : (
              <>
                {!isCollapsed && (
                  <h2 className="text-xl font-bold tracking-tight flex items-center gap-2 truncate text-zinc-900 dark:text-zinc-50">
                    <Icon icon={getIcon("logo")} className="w-6 h-6 shrink-0" style={{ color: primary }} />
                    Pfeilwurf.de
                  </h2>
                )}
                {isCollapsed && (
                  <Icon icon={getIcon("logo")} className="w-8 h-8 shrink-0" style={{ color: primary }} />
                )}
              </>
            )}
          </div>

          {/* Collapse toggle */}
          <Button
            variant="ghost" size="icon"
            className="absolute -right-4 top-7 h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm z-10"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>

          {/* Main nav */}
          <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">

            {/* ── Liga section ── */}
            {isCollapsed ? (
              // Collapsed: just the liga icon linking to overview
              <Link href="/liga" title="Ligen"
                className={cn(
                  "flex items-center justify-center rounded-md py-3 text-sm font-medium transition-colors",
                  pathname.startsWith("/liga")
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-50",
                )}
              >
                <Icon icon={getIcon("liga")} className={cn("shrink-0", iconSize)} style={pathname.startsWith("/liga") ? { color: primary } : undefined} />
              </Link>
            ) : (
              // Expanded: Liga section header + sub-items
              <div>
                <button
                  onClick={() => setLigaExpanded(!ligaExpanded)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname.startsWith("/liga")
                      ? "text-zinc-900 dark:text-zinc-50"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50",
                  )}
                >
                  <Icon
                    icon={getIcon("liga")}
                    className={cn("shrink-0", iconSize)}
                    style={pathname.startsWith("/liga") ? { color: primary } : undefined}
                  />
                  <span className="flex-1 text-left">Ligen</span>
                  <ChevronDown
                    className={cn("w-3.5 h-3.5 transition-transform text-zinc-400", ligaExpanded && "rotate-180")}
                  />
                </button>

                {ligaExpanded && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-zinc-200 dark:border-zinc-700 pl-3">
                    {ligen.length === 0 && isAdmin ? (
                      <Link
                        href="/liga"
                        className="block text-xs text-zinc-400 dark:text-zinc-500 py-1.5 px-2 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                      >
                        Keine Liga vorhanden
                      </Link>
                    ) : (
                      ligen.map((liga) => {
                        const ligaActive = pathname === `/liga/${liga.id}` || pathname.startsWith(`/liga/${liga.id}/`);
                        return (
                          <Link
                            key={liga.id}
                            href={`/liga/${liga.id}`}
                            className={cn(
                              "flex items-center gap-2 py-1.5 px-2 rounded-md text-sm transition-colors",
                              ligaActive
                                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-medium"
                                : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-800 dark:hover:text-zinc-200",
                            )}
                          >
                            {liga.abbreviation ? (
                              <span
                                className="text-[10px] font-black font-mono w-8 shrink-0 text-center leading-none px-1 py-0.5 rounded"
                                style={ligaActive
                                  ? { color: liga.themeColor || primary, backgroundColor: (liga.themeColor || primary) + "18" }
                                  : liga.themeColor
                                    ? { color: liga.themeColor }
                                    : { color: "rgb(107 114 128)" }
                                }
                              >
                                {liga.abbreviation}
                              </span>
                            ) : (
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: liga.themeColor || "rgb(161 161 170)" }}
                              />
                            )}
                            <span className="truncate text-xs">{liga.name}</span>
                          </Link>
                        );
                      })
                    )}
                    {isAdmin && (
                      <Link
                        href="/liga"
                        className={cn(
                          "flex items-center gap-2 py-1.5 px-2 rounded-md text-xs transition-colors",
                          pathname === "/liga"
                            ? "text-zinc-700 dark:text-zinc-300 font-medium"
                            : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300",
                        )}
                      >
                        <Icon icon="mdi:view-list" className="w-3 h-3 shrink-0" />
                        Alle Ligen
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Other nav items ── */}
            {mainNav.map((item) => {
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href} title={isCollapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center rounded-md text-sm font-medium transition-colors",
                    isCollapsed ? "justify-center py-3" : "gap-3 px-3 py-2",
                    active
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-50",
                  )}
                >
                  <Icon icon={getIcon(item.iconKey)} className={cn("shrink-0", iconSize)} style={active ? { color: primary } : undefined} />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Bottom nav */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
            {bottomNav.map((item) => {
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href} title={isCollapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center rounded-md text-sm font-medium transition-colors",
                    isCollapsed ? "justify-center py-3" : "gap-3 px-3 py-2",
                    active
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-50",
                  )}
                >
                  <Icon icon={getIcon(item.iconKey)} className={cn("shrink-0", iconSize)} style={active ? { color: primary } : undefined} />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </div>
        </aside>
      )}

      {/* ── Main content ── */}
      <main className={cn("flex-1 overflow-auto", !isMatchPage && "pb-20 md:pb-0")}>
        {children}
      </main>

      {/* ── Mobile Bottom Navigation Bar (MD3) ── */}
      {!isMatchPage && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-stretch h-16">
            {/* Liga always first in mobile nav */}
            <MobileNavItem
              href="/liga"
              label="Liga"
              iconKey="liga"
              active={pathname.startsWith("/liga")}
              getIcon={getIcon}
              primaryColor={primary}
            />
            {mainNav.map((item) => (
              <MobileNavItem
                key={item.href}
                href={item.href}
                label={item.name}
                iconKey={item.iconKey}
                active={isActive(item.href)}
                getIcon={getIcon}
                primaryColor={primary}
              />
            ))}

            {/* Trenner */}
            <div className="w-px bg-zinc-200 dark:bg-zinc-800 my-3 shrink-0" />

            {/* Account – mit Avatar */}
            <Link
              href="/account"
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative group"
            >
              <span className={cn(
                "flex items-center justify-center w-14 h-8 rounded-full transition-all duration-200",
                isActive("/account") ? "bg-amber-100 dark:bg-amber-950/40" : "group-active:bg-zinc-100 dark:group-active:bg-zinc-800",
              )}>
                {playerAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={playerAvatar}
                    alt="Avatar"
                    className={cn(
                      "w-7 h-7 rounded-full object-cover border-2 transition-colors",
                      isActive("/account") ? "border-amber-400" : "border-zinc-300 dark:border-zinc-600",
                    )}
                  />
                ) : (
                  <Icon
                    icon={getIcon("account")}
                    className="w-5 h-5 transition-colors"
                    style={isActive("/account") ? { color: primary } : undefined}
                  />
                )}
              </span>
              <span className={cn(
                "text-[10px] leading-none font-medium transition-colors",
                isActive("/account") ? "" : "text-zinc-500 dark:text-zinc-400",
              )}
                style={isActive("/account") ? { color: primary } : undefined}
              >
                {t("nav.account") || "Account"}
              </span>
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}

function MobileNavItem({
  href, label, iconKey, active, getIcon, primaryColor,
}: {
  href: string;
  label: string;
  iconKey: Parameters<ReturnType<typeof useAppIcon>>[0];
  active: boolean;
  getIcon: ReturnType<typeof useAppIcon>;
  primaryColor: string;
}) {
  const bgAlpha = primaryColor + "20"; // 12% alpha
  return (
    <Link href={href} className="flex-1 flex flex-col items-center justify-center gap-0.5 relative group">
      <span
        className="flex items-center justify-center w-14 h-8 rounded-full transition-all duration-200"
        style={active ? { backgroundColor: bgAlpha } : undefined}
      >
        <Icon
          icon={getIcon(iconKey)}
          className="w-5 h-5 transition-colors"
          style={active ? { color: primaryColor } : undefined}
        />
      </span>
      <span
        className={cn("text-[10px] leading-none font-medium transition-colors", !active && "text-zinc-500 dark:text-zinc-400")}
        style={active ? { color: primaryColor } : undefined}
      >
        {label}
      </span>
    </Link>
  );
}
