import { sql } from "drizzle-orm";

/**
 * Defense-in-depth against a TOCTOU race between getAdminCount() and the write
 * that follows it: two concurrent requests targeting two *different* admins can
 * each observe adminCount === 2, both pass canModifyUser(), and both proceed —
 * leaving zero admins. Folding the count into the statement's own WHERE clause
 * makes the check and the write a single atomic statement, so the loser of the
 * race becomes a no-op instead.
 *
 * Evaluates to true unless the target is an admin and is the only one left.
 * Apply it to *every* statement of a multi-statement operation, so that when it
 * fires the whole operation is a no-op rather than a partial one.
 *
 * This is additive to the app-level canModifyUser() check, which remains the
 * primary, friendly error path in the normal non-racing case.
 */
export const notLastAdmin = (targetUserId: number) =>
  sql`((SELECT count(*) FROM users a WHERE a.role = 'admin') > 1 OR NOT EXISTS (SELECT 1 FROM users t WHERE t.id = ${targetUserId} AND t.role = 'admin'))`;
