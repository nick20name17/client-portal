import { env } from "@/utils/env";
import { Resend } from "resend";

let client: Resend | null = null;

export function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!client) {
    client = new Resend(env.RESEND_API_KEY);
  }
  return client;
}
