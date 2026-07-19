import {
  IonButton,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import type {
  CSSProperties,
  ReactNode,
} from "react";
import { useHistory } from "react-router-dom";

const pageBackground = {
  "--background":
    "linear-gradient(180deg, rgba(15,12,10,.90), rgba(15,12,10,.97)), url('/assets/rapa-go-bg.jpg') center / cover no-repeat fixed",
} as CSSProperties;

export const publicSiteStyles = {
  shell: {
    width: "min(94vw, 980px)",
    margin: "24px auto 48px",
    color: "#f6f2ec",
  } as CSSProperties,
  hero: {
    padding: "28px",
    borderRadius: 28,
    background:
      "linear-gradient(135deg, rgba(143,60,36,.94), rgba(28,22,18,.97) 54%, rgba(200,155,60,.88))",
    border: "1px solid rgba(248,216,121,.40)",
    boxShadow: "0 24px 64px rgba(0,0,0,.42)",
    marginBottom: 18,
  } as CSSProperties,
  card: {
    padding: "22px",
    borderRadius: 22,
    background: "rgba(20,20,19,.96)",
    border: "1px solid rgba(214,166,64,.28)",
    boxShadow: "0 16px 46px rgba(0,0,0,.30)",
    marginBottom: 16,
  } as CSSProperties,
  muted: {
    color: "rgba(246,242,236,.76)",
    lineHeight: 1.65,
  } as CSSProperties,
  link: {
    color: "#f8d879",
    fontWeight: 850,
  } as CSSProperties,
};

export function PublicSiteShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}): JSX.Element {
  const history = useHistory();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar
          style={
            {
              "--background":
                "linear-gradient(135deg,#111 0%,#5a241a 58%,#c89b3c 135%)",
              "--color": "#fff",
              "--min-height": "70px",
            } as CSSProperties
          }
        >
          <IonTitle style={{ fontWeight: 950 }}>RAPA GO</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={pageBackground}>
        <main style={publicSiteStyles.shell}>
          <section style={publicSiteStyles.hero}>
            <p
              style={{
                margin: "0 0 8px",
                color: "#f8d879",
                fontWeight: 950,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                fontSize: ".78rem",
              }}
            >
              Movilidad y turismo en Rapa Nui
            </p>
            <h1 style={{ margin: 0, fontSize: "clamp(1.9rem,5vw,3rem)" }}>
              {title}
            </h1>
            <p style={{ ...publicSiteStyles.muted, marginBottom: 0 }}>
              {subtitle}
            </p>
          </section>

          {children}

          <nav
            aria-label="Enlaces públicos de RAPA GO"
            style={{
              ...publicSiteStyles.card,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <IonButton fill="clear" onClick={() => history.push("/privacidad")}>
              Privacidad
            </IonButton>
            <IonButton fill="clear" onClick={() => history.push("/terminos")}>
              Términos
            </IonButton>
            <IonButton fill="clear" onClick={() => history.push("/eula")}>
              EULA
            </IonButton>
            <IonButton fill="clear" onClick={() => history.push("/soporte")}>
              Soporte
            </IonButton>
            <IonButton
              fill="outline"
              color="warning"
              onClick={() => history.push("/eliminar-cuenta")}
            >
              Eliminar cuenta
            </IonButton>
            <IonButton fill="clear" onClick={() => history.push("/welcome")}>
              Volver a RAPA GO
            </IonButton>
          </nav>
        </main>
      </IonContent>
    </IonPage>
  );
}
