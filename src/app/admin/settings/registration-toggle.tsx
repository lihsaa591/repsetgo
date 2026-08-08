"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setRegistrationsOpen } from "@/lib/server/admin/actions";

export function RegistrationToggle({ initialOpen }: { initialOpen: boolean }) {
  const [state, action, pending] = useActionState(setRegistrationsOpen, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">General</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <form action={action}>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Allow new registrations</p>
              <p className="text-xs text-muted-foreground">
                Turn off to close signups to the public
              </p>
            </div>
            <input
              type="checkbox"
              name="registrationsOpen"
              defaultChecked={initialOpen}
              disabled={pending}
              className="h-4 w-4"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
          </div>
        </form>
        {state?.error && (
          <p className="text-xs text-destructive" role="alert">
            {state.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
