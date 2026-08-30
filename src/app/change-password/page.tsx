import ChangePasswordForm from "@/components/change-password-form";

export default function ChangePasswordPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          You need to set a new password before continuing.
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
