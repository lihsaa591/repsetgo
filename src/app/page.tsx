import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decrypt } from "@/lib/server/auth/session";

// `/` is an entry point only. `proxy.ts` already bounces unauthenticated
// visitors to /login, but this re-checks so the route is correct on its own.
export default async function Home() {
  const cookieStore = await cookies();
  const session = await decrypt(cookieStore.get("session")?.value);

  redirect(session ? "/dashboard" : "/login");
}
