import { createContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { useSelector } from 'react-redux';
import type { RootState } from '@/core/store';
import { resolveApiBaseUrl } from '@/core/api/baseUrl';

interface SocketContextValue {
  chatSocket: Socket | null;
  notificationSocket: Socket | null;
  supportSocket: Socket | null;
}

export const SocketContext = createContext<SocketContextValue>({
  chatSocket: null,
  notificationSocket: null,
  supportSocket: null,
});

const API_BASE_URL = resolveApiBaseUrl();

export function SocketProvider({ children }: { children: ReactNode }) {
  const { accessToken, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [chatSocket, setChatSocket] = useState<Socket | null>(null);
  const [notificationSocket, setNotificationSocket] = useState<Socket | null>(null);
  const [supportSocket, setSupportSocket] = useState<Socket | null>(null);
  const chatRef = useRef<Socket | null>(null);
  const notifRef = useRef<Socket | null>(null);
  const supportRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      const chat = io(API_BASE_URL, {
        auth: { token: accessToken },
        path: '/api/v1/chat/socket.io',
        transports: ['websocket', 'polling'],
      });
      chatRef.current = chat;
      setChatSocket(chat);

      const notif = io(`${API_BASE_URL}/notifications`, {
        auth: { token: accessToken },
        path: '/api/v1/notifications/socket.io',
        transports: ['websocket', 'polling'],
      });
      notifRef.current = notif;
      setNotificationSocket(notif);

      const support = io(API_BASE_URL, {
        auth: { token: accessToken },
        path: '/api/v1/support/socket.io',
        transports: ['websocket', 'polling'],
      });
      supportRef.current = support;
      setSupportSocket(support);

      return () => {
        chat.disconnect();
        notif.disconnect();
        support.disconnect();
        chatRef.current = null;
        notifRef.current = null;
        supportRef.current = null;
        setChatSocket(null);
        setNotificationSocket(null);
        setSupportSocket(null);
      };
    } else {
      // Disconnect if logged out
      chatRef.current?.disconnect();
      notifRef.current?.disconnect();
      supportRef.current?.disconnect();
      chatRef.current = null;
      notifRef.current = null;
      supportRef.current = null;
      setChatSocket(null);
      setNotificationSocket(null);
      setSupportSocket(null);
    }
  }, [isAuthenticated, accessToken]);

  return (
    <SocketContext.Provider value={{ chatSocket, notificationSocket, supportSocket }}>
      {children}
    </SocketContext.Provider>
  );
}
