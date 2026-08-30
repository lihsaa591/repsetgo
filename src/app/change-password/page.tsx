import ChangePasswordForm from "@/components/change-password-form";
import { logout } from "@/lib/server/auth/actions";

export default function ChangePasswordPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          You need to set a new password before continuing.
        </p>
      </div>
      <ChangePasswordForm redirectTo="/dashboard" />
      <form action={logout} className="text-center">
        <button
          type="submit"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          Log out instead
        </button>
      </form>
    </div>
  );
}
