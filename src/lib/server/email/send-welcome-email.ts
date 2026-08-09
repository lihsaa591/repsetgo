import "server-only";
import { resend } from "./client";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      to,
      subject: "Welcome to RepSetGo",
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        <p>Welcome to RepSetGo! Your account is ready — log your first workout whenever you're set.</p>
      `,
    });

    if (error) {
      console.error("Failed to send welcome email:", error);
    }
  } catch (error) {
    // A failed email send should never break signup — log and move on.
    console.error("Failed to send welcome email:", error);
  }
}
