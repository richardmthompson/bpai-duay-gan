/**
 * Magic-link delivery. With SMTP_* set it sends for real; without them it logs the link and says
 * so, which keeps local development and the demo working without an inbox.
 */
import nodemailer from "nodemailer";

const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

const transport = configured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER as string, pass: process.env.SMTP_PASS as string },
    })
  : null;

export async function sendMagicLink(email: string, url: string): Promise<{ sent: boolean; reason?: string }> {
  if (!transport) {
    console.warn(`[mailer] SMTP is not configured — magic link for ${email}: ${url}`);
    return { sent: false, reason: "smtp_not_configured" };
  }
  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM ?? process.env.SMTP_USER,
      to: email,
      subject: "ไปด้วยกัน — your sign-in link",
      text: `Open this link to sign in to Bpai Duay Gan:\n\n${url}\n\nIt works once and expires in 20 minutes.`,
    });
    return { sent: true };
  } catch (err) {
    console.error("[mailer] send failed:", err instanceof Error ? err.message : err);
    return { sent: false, reason: "send_failed" };
  }
}
