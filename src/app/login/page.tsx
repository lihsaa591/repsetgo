"use client";

import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { login } from "@/lib/server/auth/actions";
import { requestPasswordReset } from "@/lib/server/auth/password-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  // Controlled inputs: React resets uncontrolled fields to blank after any
  // form action completes (success or failure), which would wipe what the
  // user typed the moment a validation error appears. Tracking values in
  // state keeps them in place across that reset.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [resetOpen, setResetOpen] = useState(false);
  const [resetState, resetAction, resetPending] = useActionState(
    requestPasswordReset,
    undefined
  );
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    if (resetState?.message) {
      setResetMessage(resetState.message);
    }
  }, [resetState]);

  function handleResetOpenChange(open: boolean) {
    setResetOpen(open);
    if (!open) {
      setResetMessage(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[38rem] flex-col justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Dumbbell className="h-7 w-7" />
        </div>
        <span className="text-xl font-semibold">RepSetGo</span>
        <p className="text-sm text-muted-foreground">Simple, fast gym logging.</p>
      </div>
      <Card className="[--card-spacing:--spacing(8)]">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {state?.errors?.email && (
                <p className="text-xs text-destructive">{state.errors.email[0]}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {state?.errors?.password && (
                <p className="text-xs text-destructive">{state.errors.password[0]}</p>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox id="rememberMe" name="rememberMe" value="on" />
                <Label htmlFor="rememberMe" className="cursor-pointer font-normal text-muted-foreground">
                  Remember me
                </Label>
              </div>
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
            {state?.message && (
              <p className="text-xs text-destructive">{state.message}</p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Logging in..." : "Log in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>

      <Dialog open={resetOpen} onOpenChange={handleResetOpenChange}>
        <DialogContent>
          {resetMessage ? (
            <>
              <DialogHeader>
                <DialogTitle>Check with your admin</DialogTitle>
                <DialogDescription>{resetMessage}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" onClick={() => setResetOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Request a password reset</DialogTitle>
                <DialogDescription>
                  Enter your account email. An admin will be notified and can
                  reset your password for you.
                </DialogDescription>
              </DialogHeader>
              <form action={resetAction} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="resetEmail">Email</Label>
                  <Input id="resetEmail" name="email" type="email" required />
                  {resetState?.errors?.email && (
                    <p className="text-xs text-destructive">
                      {resetState.errors.email[0]}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setResetOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={resetPending}>
                    {resetPending ? "Submitting..." : "Submit"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
