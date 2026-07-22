import { IonButton, IonIcon } from "@ionic/react";
import {
  callOutline,
  logoWhatsapp,
  mailOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import type { CSSProperties, ReactNode } from "react";

import {
  PublicSiteShell,
  publicSiteStyles,
} from "./PublicSiteShell.js";

const UPDATED_AT = "19 de julio de 2026";
const SUPPORT_PHONE_DISPLAY = "+56 9 4796 4171";
const SUPPORT_PHONE_DIGITS = "56947964171";
const PRIVACY_EMAIL = "privacidad@rapago.cl";

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section style={publicSiteStyles.card}>
      <h2
        style={{
          margin: "0 0 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "#f8d879",
          fontSize: "1.14rem",
          fontWeight: 900,
          lineHeight: 1.25,
          letterSpacing: "0.01em",
        }}
      >
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 20,
            height: 4,
            borderRadius: 2,
            background: "linear-gradient(90deg,#f8d879,#d6a640)",
            boxShadow: "0 2px 8px rgba(214,166,64,.40)",
          }}
        />
        {title}
      </h2>
      <div style={publicSiteStyles.muted}>{children}</div>
    </section>
  );
}

function List({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ul
      className="rapago-public-list"
      style={{ margin: "10px 0 0", paddingLeft: 22, lineHeight: 1.75 }}
    >
      {children}
    </ul>
  );
}

export function PrivacyPublicPage(): JSX.Element {
  return (
    <PublicSiteShell
      title="Política de privacidad"
      subtitle={`Haka Taiko SpA — RAPA GO. Última actualización: ${UPDATED_AT}.`}
    >
      <Section title="1. Responsable y alcance">
        <p>
          RAPA GO es una plataforma de movilidad y servicios turísticos operada
          por Haka Taiko SpA en Rapa Nui, Chile. Esta política se aplica a la
          aplicación móvil, al panel administrativo y a los formularios web
          públicos vinculados al servicio.
        </p>
        <p>
          Contacto de privacidad: <a style={publicSiteStyles.link} href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
        </p>
      </Section>

      <Section title="2. Datos que tratamos">
        <List>
          <li>Identificación y cuenta: nombre, correo, teléfono, RUT o pasaporte cuando corresponda.</li>
          <li>Ubicación: origen, destino y posición durante la prestación de un viaje activo.</li>
          <li>Operación: viajes, reservas, cancelaciones, calificaciones, reclamos y soporte.</li>
          <li>Conductor: licencia, vehículo, patente, fotografías y documentos de habilitación.</li>
          <li>Pagos: órdenes, estado, medio de pago, comprobantes y beneficios por pago de más.</li>
          <li>Seguridad: sesiones, dirección IP, dispositivo, registros técnicos y auditoría.</li>
        </List>
      </Section>

      <Section title="3. Finalidades y base del tratamiento">
        <List>
          <li>Crear y administrar la cuenta.</li>
          <li>Solicitar, asignar, realizar y cerrar viajes o reservas.</li>
          <li>Calcular tarifas, procesar pagos y atender devoluciones o beneficios.</li>
          <li>Validar conductores, residentes y documentos obligatorios.</li>
          <li>Prevenir fraude, proteger a usuarios y responder a emergencias.</li>
          <li>Cumplir obligaciones legales, tributarias y de conservación documental.</li>
        </List>
        <p>
          Solicitamos autorización cuando corresponde y tratamos solo los datos
          necesarios para las finalidades informadas o para ejecutar el servicio.
        </p>
      </Section>

      <Section title="4. Ubicación y mapas">
        <p>
          La ubicación se utiliza para mostrar el mapa, calcular rutas, encontrar
          el punto de recogida y permitir seguimiento durante un viaje activo. La
          ubicación en segundo plano se solicita únicamente al conductor cuando ya
          tiene un viaje activo, para mantener visible su posición al pasajero y al
          operador aunque la aplicación quede minimizada. El seguimiento se detiene
          al finalizar o cancelar el viaje, al cerrar la sesión o cuando el permiso
          es retirado. RAPA GO no debe usar ubicación en segundo plano cuando no
          exista una función operacional activa que lo justifique. Puedes retirar
          el permiso desde la configuración del dispositivo, aunque algunas
          funciones dejarán de estar disponibles.
        </p>
      </Section>

      <Section title="5. Proveedores y destinatarios">
        <p>
          Podemos utilizar proveedores de mapas, infraestructura, correo,
          notificaciones y pagos. Solo reciben la información necesaria para su
          función y deben aplicar medidas de seguridad. Los datos del viaje se
          comparten con pasajero y conductor únicamente en la medida necesaria
          para realizar el servicio. No vendemos datos personales.
        </p>
      </Section>

      <Section title="6. Conservación, eliminación y anonimización">
        <p>
          Conservamos los datos mientras la cuenta esté activa y, después, solo
          durante el tiempo requerido por obligaciones legales, tributarias,
          prevención de fraude o defensa de derechos. Al aprobarse una eliminación,
          revocamos sesiones, bloqueamos el acceso y eliminamos o anonimizamos la
          información que no deba conservarse.
        </p>
        <p>
          Puedes iniciar la solicitud dentro de la aplicación o desde
          <a style={publicSiteStyles.link} href="/eliminar-cuenta"> rapago.cl/eliminar-cuenta</a>.
          La solicitud pasa a revisión administrativa y no elimina la cuenta de
          manera automática.
        </p>
      </Section>

      <Section title="7. Derechos y contacto">
        <p>
          Puedes solicitar acceso, rectificación, eliminación, oposición y demás
          derechos reconocidos por la normativa aplicable. La Ley N.º 19.628 se
          encuentra vigente a la fecha de esta política. RAPA GO también prepara
          sus procesos para la Ley N.º 21.719, cuya vigencia general comienza el
          1 de diciembre de 2026.
        </p>
        <p>
          Envía tu solicitud a <a style={publicSiteStyles.link} href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> o utiliza el formulario de eliminación.
        </p>
        <p>
          Fuentes oficiales: <a style={publicSiteStyles.link} href="https://www.bcn.cl/leychile/navegar?idNorma=141599" target="_blank" rel="noreferrer">Ley N.º 19.628</a> y <a style={publicSiteStyles.link} href="https://www.bcn.cl/leychile/navegar?idNorma=1209272" target="_blank" rel="noreferrer">Ley N.º 21.719</a>.
        </p>
      </Section>

      <Section title="8. Seguridad y cambios">
        <p>
          Utilizamos controles de acceso por rol, cifrado en tránsito, sesiones
          revocables, auditoría y validaciones de archivos. Ningún sistema es
          infalible; por eso revisamos y mejoramos estas medidas. Los cambios
          relevantes de esta política serán informados en la aplicación o por
          canales de contacto disponibles.
        </p>
      </Section>
    </PublicSiteShell>
  );
}

export function TermsPublicPage(): JSX.Element {
  return (
    <PublicSiteShell
      title="Términos y condiciones"
      subtitle={`Condiciones de uso de RAPA GO. Vigentes desde ${UPDATED_AT}.`}
    >
      <Section title="1. Aceptación y operador">
        <p>
          Al registrarte o utilizar RAPA GO aceptas estas condiciones y los
          documentos aplicables a tu rol. El servicio es operado por Haka Taiko
          SpA en Rapa Nui, Chile. Debes proporcionar información verdadera y
          mantener protegidas tus credenciales.
        </p>
      </Section>

      <Section title="2. Servicio y tarifas">
        <p>
          RAPA GO conecta usuarios con conductores y permite gestionar servicios
          turísticos. Antes de confirmar, la aplicación debe mostrar el precio,
          moneda, forma de pago y condiciones relevantes. El monto final se
          redondeará según la regla vigente informada en la aplicación y nunca de
          forma oculta.
        </p>
      </Section>

      <Section title="3. Cancelaciones y no presentación">
        <List>
          <li>Viaje inmediato: cancelación gratuita durante los primeros 2 minutos desde la asignación del conductor.</li>
          <li>Desde el tercer minuto: cargo de 30 % de la tarifa, con tope de $3.000 CLP.</li>
          <li>Viaje programado: gratuito hasta 30 minutos antes; dentro de los últimos 30 minutos, 30 % con tope de $3.000 CLP.</li>
          <li>No presentación: después de 5 minutos de espera en el origen, 50 % de la tarifa con tope de $5.000 CLP.</li>
        </List>
        <p>
          No corresponde cargo cuando exista discrepancia de identidad o vehículo,
          riesgo de seguridad, duplicidad atribuible a la plataforma u otra causa
          imputable al operador o conductor. El detalle debe quedar registrado y
          puede ser revisado por administración.
        </p>
      </Section>

      <Section title="4. Pagos y beneficios">
        <p>
          Los pagos pueden realizarse mediante los medios habilitados. El beneficio
          por pago de más en efectivo no es una cuenta recargable: requiere
          aprobación administrativa, pertenece a la misma cuenta que pagó, no se
          transfiere y puede descontarse de un viaje posterior de esa cuenta.
        </p>
      </Section>

      <Section title="5. Conducta y seguridad">
        <p>
          Está prohibido usar la plataforma para actividades ilícitas, hostigar,
          discriminar, falsear identidad, manipular tarifas o poner en riesgo a
          terceros. Pasajeros y conductores pueden reportar incidentes. RAPA GO
          puede suspender preventivamente una cuenta mientras investiga un caso.
        </p>
      </Section>

      <Section title="6. Responsabilidad y disponibilidad">
        <p>
          La disponibilidad depende de conectividad, GPS, conductores y proveedores
          tecnológicos. RAPA GO procura continuidad y soporte, pero no garantiza
          que el servicio sea ininterrumpido. Nada de estas condiciones limita los
          derechos irrenunciables reconocidos por la legislación chilena.
        </p>
      </Section>

      <Section title="7. Cuenta y terminación">
        <p>
          Puedes solicitar la eliminación desde tu perfil o mediante el sitio
          público. La cuenta permanece activa hasta que administración apruebe la
          solicitud. Si se rechaza, recibirás el motivo y podrás presentar una
          nueva solicitud cuando corresponda.
        </p>
      </Section>

      <Section title="8. Contacto">
        <p>
          Para soporte utiliza <a style={publicSiteStyles.link} href="/soporte">rapago.cl/soporte</a> o WhatsApp al {SUPPORT_PHONE_DISPLAY}.
        </p>
      </Section>
    </PublicSiteShell>
  );
}

export function EulaPublicPage(): JSX.Element {
  return (
    <PublicSiteShell
      title="Acuerdo de licencia de usuario final"
      subtitle={`EULA de RAPA GO. Última actualización: ${UPDATED_AT}.`}
    >
      <Section title="1. Licencia">
        <p>
          Haka Taiko SpA concede una licencia personal, limitada, revocable, no
          exclusiva y no transferible para instalar y utilizar RAPA GO en un
          dispositivo compatible, exclusivamente para acceder a sus servicios.
        </p>
      </Section>

      <Section title="2. Restricciones">
        <List>
          <li>No copiar, vender, sublicenciar ni distribuir la aplicación.</li>
          <li>No intentar obtener el código fuente, eludir controles o interferir con la seguridad.</li>
          <li>No usar automatizaciones para abusar de reservas, promociones, pagos o cuentas.</li>
          <li>No utilizar marcas, contenidos o datos de RAPA GO sin autorización.</li>
        </List>
      </Section>

      <Section title="3. Actualizaciones y servicios de terceros">
        <p>
          La aplicación puede requerir actualizaciones para mantener seguridad y
          compatibilidad. Mapas, pagos, notificaciones y otros componentes pueden
          estar sujetos a términos de sus respectivos proveedores.
        </p>
      </Section>

      <Section title="4. Datos, soporte y terminación">
        <p>
          El tratamiento de datos se rige por la Política de Privacidad. La licencia
          termina si incumples estas condiciones o si la cuenta es eliminada. Tras
          la terminación debes dejar de utilizar la aplicación. Las obligaciones
          que por su naturaleza deban subsistir continuarán vigentes.
        </p>
      </Section>

      <Section title="5. Tiendas de aplicaciones">
        <p>
          Cuando RAPA GO se obtiene desde una tienda, la tienda no es responsable
          de prestar el servicio de transporte ni de administrar la cuenta. Las
          condiciones obligatorias de la plataforma de distribución se entienden
          incorporadas cuando sean aplicables.
        </p>
      </Section>

      <Section title="6. Legislación y contacto">
        <p>
          Este acuerdo se interpreta conforme a la legislación chilena, sin afectar
          derechos irrenunciables del consumidor. Para soporte consulta
          <a style={publicSiteStyles.link} href="/soporte"> rapago.cl/soporte</a>.
        </p>
      </Section>
    </PublicSiteShell>
  );
}

export function SupportPublicPage(): JSX.Element {
  const whatsappUrl = `https://wa.me/${SUPPORT_PHONE_DIGITS}?text=${encodeURIComponent(
    "Hola, necesito ayuda con RAPA GO.",
  )}`;

  const actionStyle = {
    "--border-radius": "16px",
    "--box-shadow": "0 10px 26px rgba(0,0,0,.28)",
    height: "50px",
    fontWeight: 900,
    letterSpacing: "0.02em",
    textTransform: "none",
  } as CSSProperties;

  return (
    <PublicSiteShell
      title="Soporte RAPA GO"
      subtitle="Ayuda para pasajeros, conductores, reservas, pagos y seguridad."
    >
      <Section title="Contacto oficial">
        <div style={{ display: "grid", gap: 10 }}>
          <IonButton href={whatsappUrl} target="_blank" style={actionStyle}>
            <IonIcon icon={logoWhatsapp} slot="start" />
            WhatsApp {SUPPORT_PHONE_DISPLAY}
          </IonButton>
          <IonButton href={`tel:+${SUPPORT_PHONE_DIGITS}`} fill="outline" style={actionStyle}>
            <IonIcon icon={callOutline} slot="start" />
            Llamar a soporte
          </IonButton>
          <IonButton href={`mailto:${PRIVACY_EMAIL}`} fill="outline" style={actionStyle}>
            <IonIcon icon={mailOutline} slot="start" />
            Consultas de privacidad
          </IonButton>
        </div>
      </Section>

      <Section title="Antes de contactar">
        <List>
          <li>Indica tu nombre y rol: pasajero o conductor.</li>
          <li>Adjunta el folio o ID del viaje cuando exista.</li>
          <li>Explica fecha, hora, origen, destino y forma de pago.</li>
          <li>No envíes contraseñas, códigos de acceso ni datos completos de tarjetas.</li>
        </List>
      </Section>

      <Section title="Emergencias">
        <p>
          <IonIcon icon={shieldCheckmarkOutline} /> En una emergencia real, prioriza
          los servicios públicos de emergencia correspondientes. El canal de RAPA GO
          sirve para registrar y coordinar apoyo relacionado con el viaje, pero no
          reemplaza a policía, bomberos o atención médica.
        </p>
      </Section>

      <Section title="Objetos perdidos y reclamos">
        <p>
          Envía el folio del viaje y una descripción del objeto o problema. RAPA GO
          revisará el caso y protegerá los datos de contacto de las partes. No se
          garantiza la recuperación del objeto, pero se facilitará la coordinación
          disponible.
        </p>
      </Section>

      <Section title="Eliminación de cuenta">
        <p>
          Para solicitarla fuera de la aplicación utiliza
          <a style={publicSiteStyles.link} href="/eliminar-cuenta"> rapago.cl/eliminar-cuenta</a>.
        </p>
      </Section>
    </PublicSiteShell>
  );
}
