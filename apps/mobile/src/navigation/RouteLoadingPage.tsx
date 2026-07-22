import { IonContent, IonPage, IonSpinner, IonText } from "@ionic/react";

export function RouteLoadingPage(): JSX.Element {
  return (
    <IonPage>
      <IonContent
        fullscreen
        style={{
          "--background":
            "linear-gradient(180deg, rgba(18,14,12,.96), rgba(20,20,20,.99))",
        }}
      >
        <main
          style={{
            minHeight: "100%",
            display: "grid",
            placeContent: "center",
            justifyItems: "center",
            gap: 14,
            color: "#f6f2ec",
          }}
        >
          <IonSpinner name="crescent" color="warning" />
          <IonText>
            <p style={{ margin: 0, fontWeight: 850 }}>Cargando RAPA GO…</p>
          </IonText>
        </main>
      </IonContent>
    </IonPage>
  );
}
