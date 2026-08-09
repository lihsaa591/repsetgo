"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Loader2, Trash2 } from "lucide-react";
import { setUserRole, setUserActive, deleteUser } from "@/lib/server/admin/actions";
import type { AdminUserRow } from "@/lib/server/admin/queries";

const PAGE_SIZE = 10;

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UsersList({
  users,
  currentUserId,
}: {
  users: AdminUserRow[];
  currentUserId: number;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedUsers = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Logs</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{initials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium leading-none">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ActiveControl
                      userId={user.id}
                      isActive={user.isActive}
                      isSelf={user.id === currentUserId}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.joinedAt}
                  </TableCell>
                  <TableCell className="text-sm">{user.totalLogs}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastLogDate ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <DeleteUserControl
                        userId={user.id}
                        userName={user.name}
                        isSelf={user.id === currentUserId}
                        totalLogs={user.totalLogs}
                        customExerciseCount={user.customExerciseCount}
                      />
                      <RoleControl
                        userId={user.id}
                        currentRole={user.role}
                        isSelf={user.id === currentUserId}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.max(1, p - 1));
                }}
                className={page === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(p);
                  }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
                className={
                  page === totalPages ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

function RoleControl({
  userId,
  currentRole,
  isSelf,
}: {
  userId: number;
  currentRole: "admin" | "user";
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState(setUserRole, undefined);
  const nextRole = currentRole === "admin" ? "user" : "admin";
  const disabled = pending || (isSelf && nextRole === "user");

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="role" value={nextRole} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={disabled}
          title={
            isSelf && nextRole === "user" ? "You can't demote yourself." : undefined
          }
        >
          {nextRole === "admin" ? "Make admin" : "Make user"}
        </Button>
      </form>
      {state?.error && (
        <p className="text-xs text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}

function ActiveControl({
  userId,
  isActive,
  isSelf,
}: {
  userId: number;
  isActive: boolean;
  isSelf: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(setUserActive, undefined);
  const nextActive = !isActive;
  const disabled = pending || isSelf;

  return (
    <div className="flex flex-col items-start gap-1">
      <form ref={formRef} action={action} className="flex items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="isActive" value={String(nextActive)} />
        <Switch
          checked={isActive}
          disabled={disabled}
          title={isSelf ? "You can't do that to your own account." : undefined}
          onCheckedChange={() => formRef.current?.requestSubmit()}
        />
        {pending && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        <Badge variant={isActive ? "secondary" : "destructive"}>
          {isActive ? "Active" : "Inactive"}
        </Badge>
      </form>
      {state?.error && (
        <p className="text-xs text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}

function DeleteUserControl({
  userId,
  userName,
  isSelf,
  totalLogs,
  customExerciseCount,
}: {
  userId: number;
  userName: string;
  isSelf: boolean;
  totalLogs: number;
  customExerciseCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteUser, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive"
        disabled={isSelf}
        title={isSelf ? "You can't do that to your own account." : "Delete user"}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="sr-only">Delete user</span>
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {userName}?</DialogTitle>
          <DialogDescription>
            This will permanently delete this user and {totalLogs} workout
            {totalLogs === 1 ? "" : "s"} log{totalLogs === 1 ? "" : "s"},{" "}
            {customExerciseCount} custom exercise
            {customExerciseCount === 1 ? "" : "s"}. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <form action={action}>
          <input type="hidden" name="userId" value={userId} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting..." : "Delete permanently"}
            </Button>
          </DialogFooter>
        </form>
        {state?.error && (
          <p className="text-xs text-destructive" role="alert">
            {state.error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
