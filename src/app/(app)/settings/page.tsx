import { getCurrentUser } from "@/lib/server/auth/dal";
import { AccountSettingsForm } from "./account-settings-form";

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Account Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile and preferences
        </p>
      </div>
      <AccountSettingsForm user={user} />
    </div>
  );
}
