"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { deleteWorkoutLog } from "@/lib/server/workouts/actions";
import type { WorkoutLogWithDetails } from "@/lib/server/workouts/queries";
import { Pencil, Trash2, NotebookPen } from "lucide-react";

const PAGE_SIZE = 10;

export function HistoryList({ logs }: { logs: WorkoutLogWithDetails[] }) {
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedLogs = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pendingDeleteLog = logs.find((l) => l.id === pendingDeleteId);

  return (
    <div className="flex flex-col gap-6">
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No workouts logged yet.
        </p>
      ) : (
        <Accordion className="flex flex-col gap-3">
          {pagedLogs.map((log) => (
            <AccordionItem
              key={log.id}
              value={String(log.id)}
              className="rounded-lg border px-4"
            >
              <div className="flex items-center gap-3 py-1">
                <div className="min-w-0 flex-1">
                  <AccordionTrigger className="items-center hover:no-underline">
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
                      <div className="min-w-0 text-left">
                        <p className="truncate font-medium">{log.label}</p>
                        <p className="text-xs text-muted-foreground">{log.date}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {log.exercises.length} exercises
                      </Badge>
                    </div>
                  </AccordionTrigger>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    render={<Link href={`/log/${log.id}`} />}
                    nativeButton={false}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPendingDeleteId(log.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <AccordionContent className="flex flex-col gap-4">
                {log.exercises.map((ex) => {
                  const setsWithNotes = ex.sets.filter((s) => s.note);
                  return (
                    <div key={ex.id}>
                      <p className="mb-1 text-sm font-medium">{ex.exerciseName}</p>
                      <div className="flex flex-wrap gap-2">
                        {ex.sets.map((s) => (
                          <span
                            key={s.setNumber}
                            className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                          >
                            {s.reps} reps × {s.weight}kg
                            {s.isDropset && (
                              <span
                                title="Dropset: a set taken to near-failure, then continued at a lower weight without rest"
                                className="rounded-sm bg-primary px-1 text-[10px] font-semibold tracking-wide text-primary-foreground"
                              >
                                DS
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                      {setsWithNotes.length > 0 && (
                        <div className="mt-1 flex flex-col gap-0.5">
                          {setsWithNotes.map((s) => (
                            <p
                              key={s.setNumber}
                              className="flex items-start gap-1 text-xs italic text-muted-foreground"
                            >
                              <NotebookPen className="mt-0.5 h-3 w-3 shrink-0" />
                              <span>
                                Set {s.setNumber}: {s.note}
                              </span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {log.notes && (
                  <p className="rounded-md bg-muted/50 p-2 text-xs italic text-muted-foreground">
                    &quot;{log.notes}&quot;
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

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

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteId(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workout?</DialogTitle>
            <DialogDescription>
              This will permanently remove &quot;{pendingDeleteLog?.label}&quot;
              from {pendingDeleteLog?.date}. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => {
                setPendingDeleteId(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!pendingDeleteId) return;
                setDeleting(true);
                setDeleteError(null);
                try {
                  const result = await deleteWorkoutLog(pendingDeleteId);
                  if (result?.error) {
                    setDeleteError(result.error);
                    return;
                  }
                  setPendingDeleteId(null);
                } catch {
                  setDeleteError("Couldn't delete that workout. Try again.");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
