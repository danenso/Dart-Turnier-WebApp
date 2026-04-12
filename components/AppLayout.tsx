"use client";

import { useFirebase } from "@/components/FirebaseProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { Trophy, Users, BarChart3, Settings, User, LogOut, Radius, ChevronLeft, ChevronRight, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady, logOut } = useFirebase();
  const { t } = useLanguage();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-hide completely on match page
  const isMatchPage = pathname?.includes('/match/');

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <>{children}</>;
  }

  const topNav = [
    { name: t('nav.tournaments'), href: "/", icon: Trophy },
    { name: t('nav.casual'), href: "/casual", icon: Radius },
    { name: t('nav.players'), href: "/players", icon: Users },
    { name: t('nav.standings'), href: "/standings", icon: BarChart3 },
  ];

  const bottomNav = [
    { name: t('nav.settings') || "Settings", href: "/settings", icon: Settings },
    { name: t('nav.account') || "Account", href: "/account", icon: User },
  ];

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      {!isMatchPage && (
        <aside 
          className={cn(
            "bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-all duration-300 relative",
            isCollapsed ? "w-20" : "w-64"
          )}
        >
          <div className={cn("p-6 flex items-center", isCollapsed ? "justify-center px-0" : "justify-between")}>
            {!isCollapsed && (
              <h2 className="text-xl font-bold tracking-tight flex items-center gap-2 truncate text-zinc-900 dark:text-zinc-50">
                <Radius className="w-6 h-6 text-zinc-900 dark:text-zinc-50 shrink-0" />
                Darts Manager
              </h2>
            )}
            {isCollapsed && <Radius className="w-8 h-8 text-zinc-900 dark:text-zinc-50 shrink-0" />}
          </div>

          <Button 
            variant="ghost" 
            size="icon"
            className="absolute -right-4 top-7 h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm z-10"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>

          <nav className="flex-1 px-4 space-y-2 mt-4">
            {topNav.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
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
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-50"
                  )}
                >
                  <item.icon className={cn("shrink-0", isCollapsed ? "w-6 h-6" : "w-5 h-5")} />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
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
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-50"
                  )}
                >
                  <item.icon className={cn("shrink-0", isCollapsed ? "w-6 h-6" : "w-5 h-5")} />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
            <button
              onClick={logOut}
              title={isCollapsed ? t('nav.signout') || "Sign Out" : undefined}
              className={cn(
                "w-full flex items-center rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors",
                isCollapsed ? "justify-center py-3" : "gap-3 px-3 py-2"
              )}
            >
              <LogOut className={cn("shrink-0", isCollapsed ? "w-6 h-6" : "w-5 h-5")} />
              {!isCollapsed && <span>{t('nav.signout') || "Sign Out"}</span>}
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
