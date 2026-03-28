// app/maintenance/page.tsx
"use client";

import { HardHat } from "lucide-react";

export default function MaintenancePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-center px-4">
      <HardHat className="w-24 h-24 text-amber-500 animate-bounce" />
      <h1 className="text-4xl font-bold mt-8">Under Maintenance</h1>
      <p className="text-lg text-muted-foreground mt-4">
        We are currently performing scheduled maintenance.
        <br />
        We should be back online shortly. Thank you for your patience.
      </p>
    </div>
  );
}
