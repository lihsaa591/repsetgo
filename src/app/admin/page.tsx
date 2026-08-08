import { Card, CardContent } from "@/components/ui/card";
import { getAllUsersWithStats } from "@/lib/server/admin/queries";
import { verifySession } from "@/lib/server/auth/dal";
import { UsersList } from "./users-list";
import { AddUserDialog } from "./add-user-dialog";

export default async function AdminUsersPage() {
  const [users, session] = await Promise.all([
    getAllUsersWithStats(),
    verifySession(),
  ]);

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const activeThisWeek = users.filter(
    (u) => u.lastLogDate && new Date(u.lastLogDate) >= oneWeekAgo
  ).length;
  const totalLogsSaved = users.reduce((sum, u) => sum + u.totalLogs, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Everyone registered on RepSetGo
          </p>
        </div>
        <AddUserDialog />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Total users</span>
            <span className="text-2xl font-semibold">{users.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Active this week</span>
            <span className="text-2xl font-semibold">{activeThisWeek}</span>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Total logs saved</span>
            <span className="text-2xl font-semibold">{totalLogsSaved}</span>
          </CardContent>
        </Card>
      </div>

      <UsersList users={users} currentUserId={session.userId} />
    </div>
  );
}
