import nodemailer from "nodemailer";

interface InvitationEmailOptions {
  to: string;
  playerName: string;
  email: string;
  password: string;
  appUrl?: string;
}

function buildInvitationHtml(opts: InvitationEmailOptions): string {
  const { playerName, email, password, appUrl = "" } = opts;
  const loginUrl = appUrl ? `${appUrl}/account` : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Willkommen bei der Dart-Liga!</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f13;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f13;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:16px 16px 0 0;padding:48px 40px 36px;text-align:center;">
              <div style="font-size:56px;margin-bottom:12px;">🎯</div>
              <h1 style="color:#ffffff;font-size:28px;font-weight:800;margin:0 0 8px;letter-spacing:-0.5px;">
                Dart Liga
              </h1>
              <p style="color:#94a3b8;font-size:14px;margin:0;letter-spacing:2px;text-transform:uppercase;">
                Spieler-Einladung
              </p>
            </td>
          </tr>

          <!-- Welcome Banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#e11d48 0%,#be123c 100%);padding:28px 40px;text-align:center;">
              <p style="color:#fecdd3;font-size:13px;font-weight:600;margin:0 0 6px;text-transform:uppercase;letter-spacing:2px;">
                Herzlich Willkommen
              </p>
              <h2 style="color:#ffffff;font-size:36px;font-weight:800;margin:0;text-shadow:0 2px 8px rgba(0,0,0,0.3);">
                ${playerName}
              </h2>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#1c1c28;padding:40px;">

              <p style="color:#cbd5e1;font-size:16px;line-height:1.7;margin:0 0 28px;">
                Du wurdest zur <strong style="color:#ffffff;">Dart Liga</strong> eingeladen!
                Dein Account ist jetzt aktiv – melde dich mit deinen persönlichen Zugangsdaten an und
                bring dein Spiel auf das nächste Level. 🏆
              </p>

              <!-- Credentials Card -->
              <div style="background:#12121c;border:1px solid #2d2d42;border-radius:12px;padding:28px;margin-bottom:28px;">
                <p style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 20px;">
                  Deine Zugangsdaten
                </p>

                <!-- Email -->
                <div style="margin-bottom:16px;">
                  <p style="color:#64748b;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">E-Mail</p>
                  <p style="color:#f1f5f9;font-size:16px;font-weight:600;margin:0;background:#1e1e2e;border:1px solid #2d2d42;border-radius:8px;padding:10px 14px;">
                    ${email}
                  </p>
                </div>

                <!-- Password -->
                <div>
                  <p style="color:#64748b;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Passwort</p>
                  <p style="color:#f1f5f9;font-size:16px;font-weight:600;margin:0;background:#1e1e2e;border:1px solid #2d2d42;border-radius:8px;padding:10px 14px;font-family:monospace;letter-spacing:1px;">
                    ${password}
                  </p>
                </div>

                <!-- Security hint -->
                <p style="color:#475569;font-size:12px;margin:16px 0 0;display:flex;align-items:center;gap:6px;">
                  🔒 Bitte ändere dein Passwort nach dem ersten Login in deinen Account-Einstellungen.
                </p>
              </div>

              ${loginUrl ? `
              <!-- CTA Button -->
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${loginUrl}"
                   style="display:inline-block;background:linear-gradient(135deg,#e11d48 0%,#be123c 100%);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:10px;box-shadow:0 4px 20px rgba(225,29,72,0.35);letter-spacing:0.5px;">
                  Jetzt einloggen →
                </a>
              </div>
              ` : ""}

              <!-- Divider -->
              <div style="border-top:1px solid #2d2d42;margin:28px 0;"></div>

              <!-- Tip row -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:48px;vertical-align:top;padding-top:2px;">
                    <div style="width:36px;height:36px;background:#1e1e2e;border-radius:50%;text-align:center;line-height:36px;font-size:18px;">💡</div>
                  </td>
                  <td style="padding-left:12px;">
                    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;">
                      Im Account-Bereich kannst du dein Profil personalisieren, deinen Avatar hochladen
                      und deine Statistiken einsehen.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#12121c;border-top:1px solid #2d2d42;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="color:#475569;font-size:13px;margin:0 0 6px;">
                Viel Erfolg auf der Bahn! 🎯
              </p>
              <p style="color:#334155;font-size:12px;margin:0;">
                Diese E-Mail wurde automatisch generiert. Bitte antworte nicht darauf.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendInvitationEmail(opts: InvitationEmailOptions): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Dart Liga" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: opts.to,
    subject: `🎯 Willkommen bei der Dart Liga, ${opts.playerName}!`,
    html: buildInvitationHtml(opts),
  });
}
