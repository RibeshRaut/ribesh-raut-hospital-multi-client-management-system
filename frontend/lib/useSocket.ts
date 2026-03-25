import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, ...args: any[]) => void;
  on: (event: string, callback: (data: any) => void) => () => void;
}

/**
 * Custom hook for managing WebSocket connections using Socket.IO
 * @param options - Socket.IO configuration options
 * @returns Object with socket instance and helper methods
 */
export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const {
    url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002',
    autoConnect = true,
    reconnection = true,
    reconnectionDelay = 1000,
    reconnectionDelayMax = 5000,
    reconnectionAttempts = 5,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const listenersRef = useRef<Map<string, Set<Function>>>(new Map());

  // Initialize socket connection
  useEffect(() => {
    if (!autoConnect) return;

    if (!socketRef.current) {
      socketRef.current = io(url, {
        reconnection,
        reconnectionDelay,
        reconnectionDelayMax,
        reconnectionAttempts,
        transports: ['websocket', 'polling'],
      });

      // Connection event listeners
      socketRef.current.on('connect', () => {
        isConnectedRef.current = true;
        console.log('✅ Socket connected:', socketRef.current?.id);
      });

      socketRef.current.on('disconnect', () => {
        isConnectedRef.current = false;
        console.log('❌ Socket disconnected');
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
    }

    return () => {
      // Don't disconnect on unmount, keep the connection alive
      // Only clean up listeners
    };
  }, [url, autoConnect, reconnection, reconnectionDelay, reconnectionDelayMax, reconnectionAttempts]);

  const emit = useCallback((event: string, ...args: any[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, ...args);
    } else {
      console.warn(`Cannot emit event "${event}": socket not connected`);
    }
  }, []);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (!socketRef.current) {
      console.warn('Socket not initialized');
      return () => {};
    }

    socketRef.current.on(event, callback);

    // Return unsubscribe function
    return () => {
      socketRef.current?.off(event, callback);
    };
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current && !socketRef.current.connected) {
      socketRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.disconnect();
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected: isConnectedRef.current,
    connect,
    disconnect,
    emit,
    on,
  };
}
