"use client";

import { useFirebase } from "@/components/FirebaseProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { useAppIcon } from "@/components/ThemeCustomizerProvider";
import { Icon } from "@iconify/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "./ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady, logOut } = useFirebase();
  const { t } = useLanguage();
  const getIcon = useAppIcon();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isMatchPage = pathname?.includes("/match/");

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  const mainNav = [
    { name: "Liga",               href: "/liga",        iconKey: "liga"        as const },
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

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">

      {/* ── Desktop Sidebar (md+) ── */}
      {!isMatchPage && (
        <aside
          className={cn(
            "hidden md:flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 relative",
            isCollapsed ? "w-20" : "w-64",
          )}
        >
          {/* Logo */}
          <div
            className={cn(
              "p-6 flex items-center",
              isCollapsed ? "justify-center px-0" : "justify-between",
            )}
          >
            {!isCollapsed && (
              <h2 className="text-xl font-bold tracking-tight flex items-center gap-2 truncate text-zinc-900 dark:text-zinc-50">
                <Icon icon={getIcon("logo")} className="w-6 h-6 shrink-0" />
                Pfeilwurf.de
              </h2>
            )}
            {isCollapsed && (
              <Icon icon={getIcon("logo")} className="w-8 h-8 text-zinc-900 dark:text-zinc-50 shrink-0" />
            )}
          </div>

          {/* Collapse toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-4 top-7 h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm z-10"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>

          {/* Main nav */}
          <nav className="flex-1 px-4 space-y-1 mt-4">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.name : undefined}
                className={cn(
                  "flex items-center rounded-md text-sm font-medium transition-colors",
                  isCollapsed ? "justify-center py-3" : "gap-3 px-3 py-2",
                  isActive(item.href)
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-50",
                )}
              >
                <Icon icon={getIcon(item.iconKey)} className={cn("shrink-0", iconSize)} />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            ))}
          </nav>

          {/* Bottom nav */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
            {bottomNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.name : undefined}
                className={cn(
                  "flex items-center rounded-md text-sm font-medium transition-colors",
                  isCollapsed ? "justify-center py-3" : "gap-3 px-3 py-2",
                  isActive(item.href)
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-50",
                )}
              >
                <Icon icon={getIcon(item.iconKey)} className={cn("shrink-0", iconSize)} />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            ))}
          </div>
        </aside>
      )}

      {/* ── Main content ── */}
      <main className={cn("flex-1 overflow-auto", !isMatchPage && "pb-24 md:pb-0")}>
        {children}
      </main>

      {/* ── Mobile Bottom Navigation Bar (MD3) ── */}
      {!isMatchPage && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 safe-area-inset-bottom">
          <div className="flex items-stretch h-16">

            {/* Settings – ganz links */}
            <MobileNavItem
              href="/settings"
              label={t("nav.settings") || "Einstellungen"}
              iconKey="settings"
              active={isActive("/settings")}
              getIcon={getIcon}
            />

            {/* Trenner */}
            <div className="w-px bg-zinc-200 dark:bg-zinc-800 my-3 shrink-0" />

            {/* Hauptnavigation – Mitte */}
            <div className="flex flex-1 items-stretch">
              {mainNav.map((item) => (
                <MobileNavItem
                  key={item.href}
                  href={item.href}
                  label={item.name}
                  iconKey={item.iconKey}
                  active={isActive(item.href)}
                  getIcon={getIcon}
                />
              ))}
            </div>

            {/* Trenner */}
            <div className="w-px bg-zinc-200 dark:bg-zinc-800 my-3 shrink-0" />

            {/* Account – ganz rechts */}
            <MobileNavItem
              href="/account"
              label={t("nav.account") || "Account"}
              iconKey="account"
              active={isActive("/account")}
              getIcon={getIcon}
            />
          </div>
        </nav>
      )}
    </div>
  );
}

/* ── Mobile Nav Item ── */
function MobileNavItem({
  href,
  label,
  iconKey,
  active,
  getIcon,
}: {
  href: string;
  label: string;
  iconKey: Parameters<ReturnType<typeof useAppIcon>>[0];
  active: boolean;
  getIcon: ReturnType<typeof useAppIcon>;
}) {
  return (
    <Link
      href={href}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 relative group"
    >
      {/* MD3 Active Indicator */}
      <span
        className={cn(
          "flex items-center justify-center w-14 h-8 rounded-full transition-all duration-200",
          active
            ? "bg-red-100 dark:bg-red-950/60"
            : "group-active:bg-zinc-100 dark:group-active:bg-zinc-800",
        )}
      >
        <Icon
          icon={getIcon(iconKey)}
          className={cn(
            "w-5 h-5 transition-colors",
            active
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-500 dark:text-zinc-400",
          )}
        />
      </span>

      {/* Label */}
      <span
        className={cn(
          "text-[10px] leading-none font-medium transition-colors",
          active
            ? "text-red-600 dark:text-red-400"
            : "text-zinc-500 dark:text-zinc-400",
        )}
      >
        {label}
      </span>
    </Link>
  );
}
