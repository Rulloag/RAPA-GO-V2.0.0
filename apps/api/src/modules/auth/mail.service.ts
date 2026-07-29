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
  async sendAccountDeletionVerificationCode(
    to: string,
    code: string,
    expiresMinutes: number,
  ): Promise<void> {
    await this.getTransporter().sendMail({
      from: this.getFrom(),
      to,
      subject: "Código para solicitar la eliminación de tu cuenta",
      text: [
        "Solicitaste iniciar la eliminación de tu cuenta RAPA GO desde el sitio web.",
        "",
        `Tu código de verificación es: ${code}`,
        `El código vence en ${expiresMinutes} minutos y puede utilizarse una sola vez.`,
        "",
        "Si no hiciste esta solicitud, ignora este correo.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;background:#f4efe7;padding:28px;color:#171717">
          <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #d6a640">
            <h1 style="margin:0 0 14px;color:#8f3c24">RAPA GO</h1>
            <h2 style="margin:0 0 14px">Verifica tu correo</h2>
            <p>Usa este código para continuar con la solicitud de eliminación:</p>
            <div style="font-size:34px;font-weight:900;letter-spacing:8px;text-align:center;padding:18px;border-radius:16px;background:#171717;color:#f8d879">${code}</div>
            <p>Vence en <strong>${expiresMinutes} minutos</strong> y puede utilizarse una sola vez.</p>
            <p style="color:#675a4a">Si no hiciste esta solicitud, ignora este correo.</p>
          </div>
        </div>
      `,
    });
  }

  async sendAccountDeletionRequestReceived(
    to: string,
    trackingCode?: string,
  ): Promise<void> {
    const trackingLine = trackingCode
      ? `Número de seguimiento: ${trackingCode}`
      : null;

    await this.getTransporter().sendMail({
      from: this.getFrom(),
      to,
      subject: "Recibimos tu solicitud de eliminación de cuenta",
      text: [
        "Recibimos tu solicitud para eliminar tu cuenta de RAPA GO.",
        trackingLine,
        "",
        "La cuenta no será eliminada automáticamente.",
        "Un administrador revisará la identidad y las operaciones pendientes.",
        "El plazo máximo ordinario de procesamiento es de 30 días.",
        "",
        "Si existe un impedimento objetivo y temporal, te informaremos la causa y la fecha de revisión.",
      ].filter(Boolean).join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;background:#f4efe7;padding:28px;color:#171717">
          <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #d6a640">
            <h1 style="margin:0 0 14px;color:#8f3c24">RAPA GO</h1>
            <h2 style="margin:0 0 14px">Solicitud recibida</h2>
            <p>Recibimos tu solicitud para eliminar la cuenta.</p>
            ${trackingCode ? `<p><strong>Número de seguimiento:</strong> ${trackingCode}</p>` : ""}
            <p><strong>La eliminación no es automática.</strong> Un administrador revisará la identidad y las operaciones pendientes.</p>
            <p>El plazo máximo ordinario de procesamiento es de <strong>30 días</strong>.</p>
            <p>Si existe un impedimento objetivo y temporal, te informaremos la causa y la fecha de revisión.</p>
          </div>
        </div>
      `,
    });
  }

  async sendAccountDeletionDeferred(
    to: string,
    reason: string,
    deferUntil: Date,
  ): Promise<void> {
    const date = deferUntil.toLocaleDateString("es-CL");

    await this.getTransporter().sendMail({
      from: this.getFrom(),
      to,
      subject: "Tu solicitud de eliminación fue aplazada temporalmente",
      text: [
        "Tu solicitud de eliminación sigue vigente.",
        "",
        `Causa temporal: ${reason}`,
        `Fecha máxima de revisión: ${date}`,
        "",
        "Tu cuenta continúa activa mientras se resuelve el impedimento informado.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;background:#f4efe7;padding:28px;color:#171717">
          <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #d6a640">
            <h1 style="margin:0 0 14px;color:#8f3c24">RAPA GO</h1>
            <h2 style="margin:0 0 14px">Solicitud aplazada temporalmente</h2>
            <p>Tu solicitud sigue vigente.</p>
            <p><strong>Causa temporal:</strong> ${reason.replace(/[<>]/g, "")}</p>
            <p><strong>Fecha máxima de revisión:</strong> ${date}</p>
            <p>Tu cuenta continúa activa mientras se resuelve el impedimento informado.</p>
          </div>
        </div>
      `,
    });
  }

  async sendAccountDeletionIdentityNotVerified(
    to: string,
    reason: string,
  ): Promise<void> {
    const safeReason = reason.replace(/[<>]/g, "");

    await this.getTransporter().sendMail({
      from: this.getFrom(),
      to,
      subject: "No fue posible verificar la identidad de tu solicitud",
      text: [
        "No fue posible completar la solicitud de eliminación porque no pudimos verificar la identidad de la cuenta.",
        "",
        `Detalle: ${reason}`,
        "",
        "Puedes iniciar una nueva solicitud y completar nuevamente la verificación de identidad.",
        "La cuenta continúa activa y no fue eliminada.",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;background:#f4efe7;padding:28px;color:#171717">
          <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #d6a640">
            <h1 style="margin:0 0 14px;color:#8f3c24">RAPA GO</h1>
            <h2 style="margin:0 0 14px">Identidad no verificada</h2>
            <p>No fue posible completar la solicitud de eliminación porque no pudimos verificar la identidad de la cuenta.</p>
            <p><strong>Detalle:</strong> ${safeReason}</p>
            <p>Puedes iniciar una nueva solicitud y completar nuevamente la verificación de identidad.</p>
            <p>La cuenta continúa activa y no fue eliminada.</p>
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

  async sendDriverContractAccepted(input: {
    to: string;
    name: string;
    applicationId: string;
    contractVersion: string;
    pdfBuffer: Buffer;
  }): Promise<void> {
    const safeName = input.name.replace(/[<>]/g, "").trim() || "Conductor/a";

    await this.getTransporter().sendMail({
      from: this.getFrom(),
      to: input.to,
      subject: "Confirmación de aceptación de contrato y postulación en RAPA GO",
      text: [
        `Estimado/a ${safeName}:`,
        "",
        `Confirmamos que aceptaste electrónicamente el Contrato de Prestación de Servicios de Conductor Independiente de RAPA GO, versión ${input.contractVersion}.`,
        `Identificador de postulación: ${input.applicationId}`,
        "",
        "Adjuntamos una copia íntegra en PDF para tu registro.",
        "",
        "La aceptación contractual no implica por sí sola la activación definitiva. RAPA GO continuará revisando documentos, vehículo, residencia, domicilio tributario, capacitación, franja de desconexión y demás condiciones previas.",
        "",
        "Recibirás una notificación cuando la postulación sea habilitada, requiera antecedentes adicionales o no sea aprobada.",
        "",
        "Consultas: conductores@rapago.cl · +56 9 4796 4171",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;background:#f4efe7;padding:28px;color:#171717">
          <div style="max-width:620px;margin:auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #d6a640">
            <h1 style="margin:0 0 14px;color:#8f3c24">RAPA GO</h1>
            <h2 style="margin:0 0 14px">Contrato aceptado</h2>
            <p>Estimado/a <strong>${safeName}</strong>:</p>
            <p>Confirmamos la aceptación electrónica del Contrato de Prestación de Servicios de Conductor Independiente, versión <strong>${input.contractVersion}</strong>.</p>
            <p><strong>Postulación:</strong> ${input.applicationId}</p>
            <p>Adjuntamos una copia íntegra en PDF para tu registro.</p>
            <div style="margin:20px 0;padding:16px;border-radius:14px;background:#fff8df;border:1px solid #d6a640">
              <strong>La aceptación no habilita automáticamente tu cuenta.</strong>
              <p style="margin-bottom:0">Revisaremos documentos, vehículo, residencia, domicilio tributario, capacitación y franja de desconexión antes de informar el resultado.</p>
            </div>
            <p>Consultas: <a href="mailto:conductores@rapago.cl">conductores@rapago.cl</a> · +56 9 4796 4171</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Contrato-Rapa-Go-Conductor-v${input.contractVersion}.pdf`,
          content: input.pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
  }


}