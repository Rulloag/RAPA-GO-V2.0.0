import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cl.rapago.app",
  appName: "RAPA GO",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Geolocation: {
      // Permissions requested at runtime, not here
    },
  },
};

export default config;
