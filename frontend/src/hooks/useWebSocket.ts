import { useEffect, useMemo, useState } from "react";

type ConnectionState = "connecting" | "open" | "closed" | "error";

type WsEvent = {
  type: string;
  [key: string]: unknown;
};

export function useWebSocket(token?: string) {
  const [state, setState] = useState<ConnectionState>("connecting");
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);

  const url = useMemo(() => {
    const base = import.meta.env.VITE_WS_URL as string | undefined;
    if (base && base.startsWith("ws")) {
      return base;
    }
    const api = (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
      "http://localhost:8000";
    return api.replace("http", "ws") + "/ws";
  }, []);

  useEffect(() => {
    if (!token) {
      setState("closed");
      return;
    }

    const socket = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);

    socket.onopen = () => setState("open");
    socket.onerror = () => setState("error");
    socket.onclose = () => setState("closed");
    socket.onmessage = (event) => {
      setLastMessage(event.data);
      try {
        const parsed = JSON.parse(event.data) as WsEvent;
        setLastEvent(parsed);
      } catch {
        setLastEvent(null);
      }
    };

    return () => socket.close();
  }, [url, token]);

  return { state, lastMessage, lastEvent, url };
}
