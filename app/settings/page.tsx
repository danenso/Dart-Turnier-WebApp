"use client";

import { SettingsPanel } from "@/components/SettingsPanel";

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <SettingsPanel />
      </div>
    </div>
  );
}
