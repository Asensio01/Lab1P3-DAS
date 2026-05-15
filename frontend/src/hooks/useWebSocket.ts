import { useEffect, useMemo, useState } from "react";

type ConnectionState = "connecting" | "open" | "closed" | "error";

export function useWebSocket() {
  const [state, setState] = useState<ConnectionState>("connecting");
  const [lastMessage, setLastMessage] = useState<string | null>(null);

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
    const socket = new WebSocket(url);

    socket.onopen = () => setState("open");
    socket.onerror = () => setState("error");
    socket.onclose = () => setState("closed");
    socket.onmessage = (event) => setLastMessage(event.data);

    return () => socket.close();
  }, [url]);

  return { state, lastMessage, url };
}
