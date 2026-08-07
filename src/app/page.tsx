import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-7 w-7" />
          <span className="text-xl font-semibold">RepSetGo</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Simple, fast gym logging.
        </p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Log in</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" />
          </div>
          <Button render={<Link href="/dashboard" />} nativeButton={false} className="mt-2 w-full">
            Continue
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Don&apos;t have an account? <span className="underline">Sign up</span>
          </p>
        </CardContent>
      </Card>

      {/* Mockup shortcuts — remove once auth is wired up */}
      <div className="flex gap-3 text-xs">
        <Link href="/dashboard" className="text-primary underline">
          View user dashboard mockup
        </Link>
        <Link href="/admin" className="text-primary underline">
          View admin mockup
        </Link>
      </div>
    </div>
  );
}
