import { getAppSettings } from "@/lib/server/admin/queries";
import { RegistrationToggle } from "./registration-toggle";

export default async function AdminSettingsPage() {
  const settings = await getAppSettings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">App-wide configuration</p>
      </div>

      <RegistrationToggle initialOpen={settings.registrationsOpen} />
    </div>
  );
}
