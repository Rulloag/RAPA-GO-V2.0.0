import { useState, useEffect, useRef, useCallback } from "react";
import { useConnectivity } from "./useConnectivity.js";
import { apiClient } from "../services/api/index.js";

const STORAGE_KEY = "offline_sync_queue";

interface PendingAction {
  id:          string;
  entityType:  string;
  entityId:    string | null;
  action:      string;
  payload:     object;
  createdAt:   string;
}

function loadQueue(): PendingAction[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingAction[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function useOfflineSync() {
  const isOnline      = useConnectivity();
  const [pending, setPending] = useState<number>(() => loadQueue().length);
  const syncingRef    = useRef(false);

  const addPending = useCallback((action: Omit<PendingAction, "id" | "createdAt">) => {
    const item: PendingAction = {
      ...action,
      id:        crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const queue = loadQueue();
    queue.push(item);
    saveQueue(queue);
    setPending(queue.length);
  }, []);

  useEffect(() => {
    if (!isOnline || syncingRef.current) return;

    const queue = loadQueue();
    if (queue.length === 0) return;

    syncingRef.current = true;

    (async () => {
      const remaining: PendingAction[] = [];

      for (const item of queue) {
        try {
          await apiClient.post("/sync-queue/confirm-local", {
            entityType: item.entityType,
            entityId:   item.entityId,
            action:     item.action,
            payload:    item.payload,
          });
        } catch {
          remaining.push(item);
        }
      }

      saveQueue(remaining);
      setPending(remaining.length);
      syncingRef.current = false;
    })();
  }, [isOnline]);

  return { pendingCount: pending, addPending, isOnline };
}
