import "server-only";
import { resend } from "./client";

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      to,
      subject: "Welcome to RepSetGo",
      html: `
        <p>Hi ${name},</p>
        <p>Welcome to RepSetGo! Your account is ready — log your first workout whenever you're set.</p>
      `,
    });
  } catch (error) {
    // A failed email send should never break signup — log and move on.
    console.error("Failed to send welcome email:", error);
  }
}
