import { Network } from "@capacitor/network";
import { useState, useEffect } from "react";

export function useConnectivity(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let listenerHandle: Awaited<ReturnType<typeof Network.addListener>> | undefined;

    void (async () => {
      const status = await Network.getStatus();
      setIsOnline(status.connected);

      listenerHandle = await Network.addListener("networkStatusChange", (s) => {
        setIsOnline(s.connected);
      });
    })();

    return () => {
      void listenerHandle?.remove();
    };
  }, []);

  return isOnline;
}
