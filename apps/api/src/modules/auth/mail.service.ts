import {
  createTransport,
  type Transporter,
} from "nodemailer";

type PasswordResetEmailInput = {
  to: string;
  resetUrl: string;
  expiresMinutes: number;
};

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function parseSmtpPort(): number {
  const raw = process.env["SMTP_PORT"]?.trim() ?? "465";
  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port.");
  }

  return port;
}

export class MailService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const port = parseSmtpPort();
    const secure =
      process.env["SMTP_SECURE"]?.trim().toLowerCase() === "true" ||
      port === 465;

    this.transporter = createTransport({
      host: requiredEnvironmentValue("SMTP_HOST"),
      port,
      secure,
      auth: {
        user: requiredEnvironmentValue("SMTP_USER"),
        pass: requiredEnvironmentValue("SMTP_PASSWORD"),
      },
    });

    return this.transporter;
  }

  private getFrom(): string {
    const fromEmail =
      process.env["SMTP_FROM_EMAIL"]?.trim() ||
      requiredEnvironmentValue("SMTP_USER");
    const fromName =
      process.env["SMTP_FROM_NAME"]?.trim() || "RAPA GO";

    return `"${fromName.replace(/"/g, "")}" <${fromEmail}>`;
  }

  async sendPasswordResetEmail(
    input: PasswordResetEmailInput,
  ): Promise<void> {
    await this.getTransporter().sendMail({
      from: this.getFrom(),
      to: input.to,
      subject: "Restablece tu contraseña de RAPA GO",
      text: [
        "Recibimos una solicitud para cambiar tu contraseña de RAPA GO.",
        "",
        `Abre este enlace: ${input.resetUrl}`,
        "",
        `El enlace vence en ${input.expiresMinutes} minutos y puede usarse una sola vez.`,
        "",
        "Si no solicitaste este cambio, ignora este correo.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;background:#f4efe7;padding:28px;color:#171717">
          <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #d6a640">
            <h1 style="margin:0 0 14px;color:#8f3c24">RAPA GO</h1>
            <h2 style="margin:0 0 14px">Restablecer contraseña</h2>
            <p>Recibimos una solicitud para cambiar tu contraseña.</p>
            <p style="margin:24px 0">
              <a
                href="${input.resetUrl}"
                style="display:inline-block;background:#d6a640;color:#111;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:700"
              >
                Crear nueva contraseña
              </a>
            </p>
            <p>El enlace vence en <strong>${input.expiresMinutes} minutos</strong> y puede usarse una sola vez.</p>
            <p style="color:#675a4a">Si no solicitaste este cambio, ignora este correo.</p>
          </div>
        </div>
      `,
    });
  }

  async sendPasswordChangedEmail(to: string): Promise<void> {
    await this.getTransporter().sendMail({
      from: this.getFrom(),
      to,
      subject: "Tu contraseña de RAPA GO fue cambiada",
      text: [
        "Tu contraseña de RAPA GO fue cambiada correctamente.",
        "",
        "Todas las sesiones anteriores fueron cerradas.",
        "",
        "Si no realizaste este cambio, contacta inmediatamente al soporte de RAPA GO.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;background:#f4efe7;padding:28px;color:#171717">
          <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #d6a640">
            <h1 style="margin:0 0 14px;color:#8f3c24">RAPA GO</h1>
            <h2 style="margin:0 0 14px">Contraseña actualizada</h2>
            <p>Tu contraseña fue cambiada correctamente.</p>
            <p>Todas las sesiones anteriores fueron cerradas.</p>
            <p style="color:#8f1d1d;font-weight:700">
              Si no realizaste este cambio, contacta inmediatamente al soporte de RAPA GO.
            </p>
          </div>
        </div>
      `,
    });
  }
  async sendAccountDeletionRequestReceived(
    to: string,
  ): Promise<void> {
    await this.getTransporter().sendMail({
      from: this.getFrom(),
      to,
      subject: "Recibimos tu solicitud de eliminación de cuenta",
      text: [
        "Recibimos tu solicitud para eliminar tu cuenta de RAPA GO.",
        "",
        "La cuenta no será eliminada automáticamente.",
        "Un administrador revisará el motivo y las operaciones pendientes.",
        "",
        "Te informaremos si la solicitud es aprobada o rechazada.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;background:#f4efe7;padding:28px;color:#171717">
          <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #d6a640">
            <h1 style="margin:0 0 14px;color:#8f3c24">RAPA GO</h1>
            <h2 style="margin:0 0 14px">Solicitud recibida</h2>
            <p>Recibimos tu solicitud para eliminar la cuenta.</p>
            <p><strong>La eliminación no es automática.</strong> Un administrador revisará el motivo y las operaciones pendientes.</p>
            <p>Te informaremos cuando exista una decisión.</p>
          </div>
        </div>
      `,
    });
  }

  async sendAccountDeletionRejected(
    to: string,
    reason: string,
  ): Promise<void> {
    await this.getTransporter().sendMail({
      from: this.getFrom(),
      to,
      subject: "Tu solicitud de eliminación fue rechazada",
      text: [
        "Tu solicitud de eliminación de cuenta fue rechazada.",
        "",
        `Motivo: ${reason}`,
        "",
        "Tu cuenta continúa activa.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;background:#f4efe7;padding:28px;color:#171717">
          <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #d6a640">
            <h1 style="margin:0 0 14px;color:#8f3c24">RAPA GO</h1>
            <h2 style="margin:0 0 14px">Solicitud rechazada</h2>
            <p>Tu solicitud de eliminación fue rechazada.</p>
            <p><strong>Motivo:</strong> ${reason.replace(/[<>]/g, "")}</p>
            <p>Tu cuenta continúa activa.</p>
          </div>
        </div>
      `,
    });
  }

  async sendAccountDeletionCompleted(
    to: string,
  ): Promise<void> {
    await this.getTransporter().sendMail({
      from: this.getFrom(),
      to,
      subject: "Tu cuenta de RAPA GO fue eliminada",
      text: [
        "Tu solicitud fue aprobada.",
        "",
        "La cuenta fue eliminada o anonimizada y todas las sesiones fueron cerradas.",
        "Los registros que deban conservarse por obligaciones legales permanecen restringidos y anonimizados.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;background:#f4efe7;padding:28px;color:#171717">
          <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #d6a640">
            <h1 style="margin:0 0 14px;color:#8f3c24">RAPA GO</h1>
            <h2 style="margin:0 0 14px">Cuenta eliminada</h2>
            <p>Tu solicitud fue aprobada.</p>
            <p>La cuenta fue eliminada o anonimizada y todas las sesiones fueron cerradas.</p>
            <p style="color:#675a4a">Los registros que deban conservarse por obligaciones legales permanecen restringidos y anonimizados.</p>
          </div>
        </div>
      `,
    });
  }

}