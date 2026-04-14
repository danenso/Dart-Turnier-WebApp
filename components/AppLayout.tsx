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

  const topNav = [
    { name: t("nav.tournaments"), href: "/tournaments", iconKey: "tournaments" as const },
    { name: "Liga",               href: "/liga",    iconKey: "liga"        as const },
    { name: t("nav.casual"),      href: "/casual",  iconKey: "casual"      as const },
    { name: t("nav.players"),     href: "/players", iconKey: "players"     as const },
  ];

  const bottomNav = [
    { name: t("nav.settings") || "Settings", href: "/settings", iconKey: "settings" as const },
    { name: t("nav.account")  || "Account",  href: "/account",  iconKey: "account"  as const },
  ];

  const iconSize = isCollapsed ? "w-6 h-6" : "w-5 h-5";

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      {!isMatchPage && (
        <aside
          className={cn(
            "bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-all duration-300 relative",
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
                <Icon
                  icon={getIcon("logo")}
                  className="w-6 h-6 text-zinc-900 dark:text-zinc-50 shrink-0"
                />
                Pfeilwurf.de
              </h2>
            )}
            {isCollapsed && (
              <Icon
                icon={getIcon("logo")}
                className="w-8 h-8 text-zinc-900 dark:text-zinc-50 shrink-0"
              />
            )}
          </div>

          {/* Collapse toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-4 top-7 h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm z-10"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>

          {/* Top navigation */}
          <nav className="flex-1 px-4 space-y-1 mt-4">
            {topNav.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center rounded-md text-sm font-medium transition-colors",
                    isCollapsed ? "justify-center py-3" : "gap-3 px-3 py-2",
                    isActive
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-50",
                  )}
                >
                  <Icon
                    icon={getIcon(item.iconKey)}
                    className={cn("shrink-0", iconSize)}
                  />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Bottom navigation */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
            {bottomNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center rounded-md text-sm font-medium transition-colors",
                    isCollapsed ? "justify-center py-3" : "gap-3 px-3 py-2",
                    isActive
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-50",
                  )}
                >
                  <Icon
                    icon={getIcon(item.iconKey)}
                    className={cn("shrink-0", iconSize)}
                  />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              );
            })}

            <button
              onClick={logOut}
              title={isCollapsed ? t("nav.signout") || "Sign Out" : undefined}
              className={cn(
                "w-full flex items-center rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors",
                isCollapsed ? "justify-center py-3" : "gap-3 px-3 py-2",
              )}
            >
              <Icon
                icon={getIcon("signout")}
                className={cn("shrink-0", iconSize)}
              />
              {!isCollapsed && (
                <span>{t("nav.signout") || "Sign Out"}</span>
              )}
            </button>
          </div>
        </aside>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
