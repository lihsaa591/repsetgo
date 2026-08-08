import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  joinedAt: string;
  totalLogs: number;
  lastActive: string;
};

// TODO(phase 2): replace with real admin data query — admin panel data wiring is out of scope for this task.
const adminUsers: AdminUser[] = [
  {
    id: "u1",
    name: "Aashil Bijukshe",
    email: "aashil.bijukshe@themegrill.com",
    role: "admin",
    joinedAt: "2026-06-01",
    totalLogs: 24,
    lastActive: "2026-08-02",
  },
  {
    id: "u2",
    name: "Sara Thapa",
    email: "sara.t@example.com",
    role: "user",
    joinedAt: "2026-06-15",
    totalLogs: 14,
    lastActive: "2026-08-01",
  },
  {
    id: "u3",
    name: "Rohit KC",
    email: "rohit.kc@example.com",
    role: "user",
    joinedAt: "2026-07-10",
    totalLogs: 3,
    lastActive: "2026-07-29",
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Everyone registered on RepSetGo
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Total users</span>
            <span className="text-2xl font-semibold">{adminUsers.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Active this week</span>
            <span className="text-2xl font-semibold">2</span>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Total logs saved</span>
            <span className="text-2xl font-semibold">
              {adminUsers.reduce((sum, u) => sum + u.totalLogs, 0)}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Logs</TableHead>
                <TableHead>Last active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{initials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium leading-none">{user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.joinedAt}
                  </TableCell>
                  <TableCell className="text-sm">{user.totalLogs}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastActive}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
