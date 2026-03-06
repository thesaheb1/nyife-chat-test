import { createContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { useSelector } from 'react-redux';
import type { RootState } from '@/core/store';

interface SocketContextValue {
  chatSocket: Socket | null;
  notificationSocket: Socket | null;
}

export const SocketContext = createContext<SocketContextValue>({
  chatSocket: null,
  notificationSocket: null,
});

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function SocketProvider({ children }: { children: ReactNode }) {
  const { accessToken, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [chatSocket, setChatSocket] = useState<Socket | null>(null);
  const [notificationSocket, setNotificationSocket] = useState<Socket | null>(null);
  const chatRef = useRef<Socket | null>(null);
  const notifRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      // Chat socket
      const chat = io(`${API_BASE_URL}/chat`, {
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
      });
      chatRef.current = chat;
      setChatSocket(chat);

      // Notification socket
      const notif = io(`${API_BASE_URL}/notifications`, {
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
      });
      notifRef.current = notif;
      setNotificationSocket(notif);

      return () => {
        chat.disconnect();
        notif.disconnect();
        chatRef.current = null;
        notifRef.current = null;
        setChatSocket(null);
        setNotificationSocket(null);
      };
    } else {
      // Disconnect if logged out
      chatRef.current?.disconnect();
      notifRef.current?.disconnect();
      chatRef.current = null;
      notifRef.current = null;
      setChatSocket(null);
      setNotificationSocket(null);
    }
  }, [isAuthenticated, accessToken]);

  return (
    <SocketContext.Provider value={{ chatSocket, notificationSocket }}>
      {children}
    </SocketContext.Provider>
  );
}
