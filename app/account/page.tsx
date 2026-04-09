"use client";

import { useFirebase } from "@/components/FirebaseProvider";

export default function AccountPage() {
  const { user } = useFirebase();

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Account</h1>
        <p className="text-zinc-500">Manage your account details.</p>
        
        {user && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
            <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
            <div className="space-y-2">
              <p><span className="font-medium">Name:</span> {user.displayName || 'N/A'}</p>
              <p><span className="font-medium">Email:</span> {user.email}</p>
              <p><span className="font-medium">User ID:</span> {user.uid}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
