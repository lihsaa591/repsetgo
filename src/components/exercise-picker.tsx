"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function ExercisePicker({
  id,
  value,
  options,
  onChange,
  onAddCustom,
}: {
  id?: string;
  value: string;
  options: string[];
  onChange: (name: string) => void;
  onAddCustom: (name: string) => void | Promise<void>;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value), [value]);

  function exactMatchFor(name: string) {
    return options.some((o) => o.toLowerCase() === name.trim().toLowerCase());
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        // Clicking away must never create a custom exercise — a half-typed
        // name like "Ben" would otherwise be persisted forever. Adding is
        // explicit only: the Add "…" item or pressing Enter.
        const trimmed = query.trim();
        if (exactMatchFor(trimmed)) {
          onChange(trimmed);
        } else {
          setQuery(value);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const exactMatch = options.some(
    (o) => o.toLowerCase() === query.trim().toLowerCase()
  );

  function commit(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!exactMatchFor(trimmed)) {
      onAddCustom(trimmed);
    }
    onChange(trimmed);
  }

  function selectOption(name: string) {
    setQuery(name);
    onChange(name);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(query);
            setOpen(false);
          }
        }}
        placeholder="e.g. Bench Press, Seated Row"
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-muted",
                    option === value && "bg-muted"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(option);
                  }}
                >
                  {option}
                </button>
              </li>
            ))}
            {query.trim() && !exactMatch && (
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-muted"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(query.trim());
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add &quot;{query.trim()}&quot;
                </button>
              </li>
            )}
            {filtered.length === 0 && !query.trim() && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                No exercises yet
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
