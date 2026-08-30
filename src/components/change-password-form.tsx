"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { changePassword } from "@/lib/server/auth/password-actions";

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" required />
            {state?.errors?.password && (
              <p className="text-xs text-destructive" role="alert">
                {state.errors.password[0]}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
            />
            {state?.errors?.confirmPassword && (
              <p className="text-xs text-destructive" role="alert">
                {state.errors.confirmPassword[0]}
              </p>
            )}
          </div>
          {state?.message && (
            <p className="text-xs text-destructive" role="alert">
              {state.message}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
