import {
  IonBackButton,
  IonButton,
  IonButtons,
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
    position: "relative",
    overflow: "hidden",
    padding: "32px 28px 28px",
    borderRadius: 28,
    background:
      "linear-gradient(135deg, rgba(143,60,36,.94), rgba(28,22,18,.97) 54%, rgba(200,155,60,.88))",
    border: "1px solid rgba(248,216,121,.45)",
    boxShadow: "0 28px 70px rgba(0,0,0,.48)",
    marginBottom: 20,
  } as CSSProperties,
  heroAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background:
      "linear-gradient(90deg, transparent, #f8d879 30%, #d6a640 55%, #f8d879 70%, transparent)",
  } as CSSProperties,
  card: {
    padding: "24px",
    borderRadius: 22,
    background:
      "linear-gradient(180deg, rgba(26,25,24,.97), rgba(18,17,16,.97))",
    border: "1px solid rgba(214,166,64,.30)",
    boxShadow: "0 18px 50px rgba(0,0,0,.34)",
    marginBottom: 16,
  } as CSSProperties,
  muted: {
    color: "rgba(246,242,236,.80)",
    lineHeight: 1.7,
  } as CSSProperties,
  link: {
    color: "#f8d879",
    fontWeight: 850,
    textDecoration: "underline",
    textDecorationColor: "rgba(214,166,64,.45)",
    textUnderlineOffset: "3px",
  } as CSSProperties,
  navChip: {
    "--border-radius": "999px",
    "--color": "#f8d879",
    "--background-hover": "rgba(214,166,64,.14)",
    "--background-activated": "rgba(214,166,64,.22)",
    "--padding-start": "16px",
    "--padding-end": "16px",
    border: "1px solid rgba(214,166,64,.38)",
    borderRadius: 999,
    height: 38,
    fontSize: "0.84rem",
    fontWeight: 800,
    textTransform: "none",
    letterSpacing: "0.02em",
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
              "border-bottom": "2px solid rgba(248,216,121,.35)",
            } as CSSProperties
          }
        >
          <IonButtons slot="start">
            <IonBackButton
              defaultHref="/welcome"
              text=""
              aria-label="Volver"
              style={{ "--color": "#f8d879" } as CSSProperties}
            />
          </IonButtons>
          <IonTitle style={{ fontWeight: 950, letterSpacing: ".06em" }}>
            RAPA GO
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={pageBackground}>
        <main style={publicSiteStyles.shell}>
          <section style={publicSiteStyles.hero}>
            <div style={publicSiteStyles.heroAccent} aria-hidden />
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
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(1.9rem,5vw,3rem)",
                fontWeight: 950,
                lineHeight: 1.08,
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h1>
            <p
              style={{
                ...publicSiteStyles.muted,
                marginBottom: 0,
                marginTop: 10,
                maxWidth: 620,
              }}
            >
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
              gap: 10,
              alignItems: "center",
            }}
          >
            <IonButton
              fill="clear"
              style={publicSiteStyles.navChip}
              onClick={() => history.push("/privacidad")}
            >
              Privacidad
            </IonButton>
            <IonButton
              fill="clear"
              style={publicSiteStyles.navChip}
              onClick={() => history.push("/terminos")}
            >
              Términos
            </IonButton>
            <IonButton
              fill="clear"
              style={publicSiteStyles.navChip}
              onClick={() => history.push("/eula")}
            >
              EULA
            </IonButton>
            <IonButton
              fill="clear"
              style={publicSiteStyles.navChip}
              onClick={() => history.push("/soporte")}
            >
              Soporte
            </IonButton>
            <IonButton
              fill="outline"
              color="warning"
              style={{
                "--border-radius": "999px",
                "--border-width": "1.5px",
                "--padding-start": "16px",
                "--padding-end": "16px",
                height: 38,
                fontSize: "0.84rem",
                fontWeight: 900,
                textTransform: "none",
                letterSpacing: "0.02em",
              } as CSSProperties}
              onClick={() => history.push("/eliminar-cuenta")}
            >
              Eliminar cuenta
            </IonButton>
            <IonButton
              fill="clear"
              style={{
                ...publicSiteStyles.navChip,
                "--color": "rgba(246,242,236,.72)",
                borderColor: "rgba(246,242,236,.22)",
              } as CSSProperties}
              onClick={() => history.push("/welcome")}
            >
              Volver a RAPA GO
            </IonButton>
          </nav>
        </main>
      </IonContent>
    </IonPage>
  );
}
