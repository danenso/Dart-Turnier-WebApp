import { NextRequest, NextResponse } from "next/server";
import { sendInvitationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { playerName, email, password } = body as {
      playerName: string;
      email: string;
      password: string;
    };

    if (!playerName || !email || !password) {
      return NextResponse.json(
        { error: "playerName, email und password sind Pflichtfelder." },
        { status: 400 }
      );
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json(
        { error: "SMTP nicht konfiguriert. Bitte SMTP_HOST, SMTP_USER und SMTP_PASS setzen." },
        { status: 500 }
      );
    }

    await sendInvitationEmail({
      to: email,
      playerName,
      email,
      password,
      appUrl: process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("send-invitation error:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
