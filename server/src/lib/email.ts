import { env } from "@/utils/env";
import { Resend } from "resend";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export const isEmailConfigured = () => !!(resend && env.RESEND_FROM_EMAIL);

export async function sendEmail(
    to: string,
    subject: string,
    text: string,
): Promise<boolean> {
    if (!resend || !env.RESEND_FROM_EMAIL) return false;

    try {
        await resend.emails.send({
            from: env.RESEND_FROM_EMAIL,
            to,
            subject,
            text,
        });
        return true;
    } catch (err) {
        console.error("[email] Failed to send:", err);
        return false;
    }
}
