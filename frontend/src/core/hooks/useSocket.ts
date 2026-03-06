import { useContext } from 'react';
import { SocketContext } from '@/core/providers/SocketProvider';

export function useSocket() {
  return useContext(SocketContext);
}
