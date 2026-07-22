import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonText,
} from "@ionic/react";
import { homeOutline, refreshOutline, warningOutline } from "ionicons/icons";
import { ROUTES } from "./routes.js";

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

/**
 * Prevents an unexpected render error from leaving RAPA GO as a blank screen.
 * The technical detail is only shown in non-production builds.
 */
export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  override state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("RAPA GO route render failed", error, info.componentStack);
  }

  private goHome = (): void => {
    window.location.assign(ROUTES.ROOT);
  };

  private reload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <IonPage>
        <IonContent
          fullscreen
          className="ion-padding"
          style={{
            "--background":
              "linear-gradient(180deg, rgba(18,14,12,.96), rgba(20,20,20,.99))",
          }}
        >
          <main
            style={{
              width: "min(92vw, 560px)",
              minHeight: "100%",
              margin: "0 auto",
              display: "grid",
              alignContent: "center",
              gap: 16,
              color: "#f6f2ec",
              textAlign: "center",
            }}
          >
            <IonIcon
              icon={warningOutline}
              style={{ fontSize: 58, color: "#f8d879", margin: "0 auto" }}
            />
            <IonText>
              <h1 style={{ margin: 0, fontWeight: 950 }}>
                No pudimos mostrar esta pantalla
              </h1>
            </IonText>
            <p style={{ margin: 0, color: "rgba(246,242,236,.78)" }}>
              La aplicación detectó un problema de navegación. Recarga la
              pantalla o vuelve al inicio; tus datos no fueron eliminados.
            </p>
            {import.meta.env.DEV && (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(0,0,0,.35)",
                  fontSize: 12,
                }}
              >
                {error.message}
              </pre>
            )}
            <IonButton expand="block" color="warning" onClick={this.reload}>
              <IonIcon slot="start" icon={refreshOutline} />
              Recargar
            </IonButton>
            <IonButton expand="block" fill="outline" onClick={this.goHome}>
              <IonIcon slot="start" icon={homeOutline} />
              Volver al inicio
            </IonButton>
          </main>
        </IonContent>
      </IonPage>
    );
  }
}
