"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { createUserAsAdmin } from "@/lib/server/admin/actions";

export function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createUserAsAdmin, undefined);

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} size="sm">
        <UserPlus className="h-4 w-4" /> Add user
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new user</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-user-name">Name</Label>
            <Input id="add-user-name" name="name" required />
            {state?.errors?.name && (
              <p className="text-xs text-destructive">{state.errors.name[0]}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-user-email">Email</Label>
            <Input id="add-user-email" name="email" type="email" required />
            {state?.errors?.email && (
              <p className="text-xs text-destructive">{state.errors.email[0]}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-user-password">Password</Label>
            <Input id="add-user-password" name="password" type="password" required />
            {state?.errors?.password && (
              <p className="text-xs text-destructive">{state.errors.password[0]}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-user-role">Role</Label>
            <Select name="role" defaultValue="user">
              <SelectTrigger id="add-user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {state?.message && (
            <p className="text-xs text-destructive">{state.message}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
