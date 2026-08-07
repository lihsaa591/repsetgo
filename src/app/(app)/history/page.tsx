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
import { useWorkoutLogs } from "@/hooks/use-workout-logs";
import { Pencil, Trash2 } from "lucide-react";

const PAGE_SIZE = 10;

export default function HistoryPage() {
  const { logs, deleteLog } = useWorkoutLogs();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedLogs = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pendingDeleteLog = logs.find((l) => l.id === pendingDeleteId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-sm text-muted-foreground">All your logged workouts</p>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No workouts logged yet.
        </p>
      ) : (
        <Accordion className="flex flex-col gap-3">
          {pagedLogs.map((log) => (
            <AccordionItem
              key={log.id}
              value={log.id}
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
                {log.exercises.map((ex) => (
                  <div key={ex.id}>
                    <p className="mb-1 text-sm font-medium">{ex.exerciseName}</p>
                    <div className="flex flex-wrap gap-2">
                      {ex.sets.map((s) => (
                        <span
                          key={s.setNumber}
                          className="rounded-md bg-muted px-2 py-1 text-xs"
                        >
                          {s.reps} reps × {s.weight}kg
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
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
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workout?</DialogTitle>
            <DialogDescription>
              This will permanently remove &quot;{pendingDeleteLog?.label}&quot;
              from {pendingDeleteLog?.date}. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDeleteId) deleteLog(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
