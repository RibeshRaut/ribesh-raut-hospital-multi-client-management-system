import { useEffect, useCallback, useState } from 'react';
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
  emit: (event: string, ...args: unknown[]) => void;
  on: (event: string, callback: SocketListener) => () => void;
}

type SocketListener = (...args: unknown[]) => void;

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

  const [socket, setSocket] = useState<Socket | null>(() => {
    if (!autoConnect) return null;
    const socketInstance = io(url, {
      reconnection,
      reconnectionDelay,
      reconnectionDelayMax,
      reconnectionAttempts,
      transports: ['websocket', 'polling'],
    });
    return socketInstance;
  });
  const [isConnected, setIsConnected] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    if (!autoConnect || !socket) return;

    const socketInstance = socket;

    const handleConnect = () => {
      setIsConnected(true);
      console.log('✅ Socket connected:', socketInstance.id);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      console.log('❌ Socket disconnected');
    };

    const handleError = (error: unknown) => {
      console.error('Socket connection error:', error);
    };

    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);
    socketInstance.on('connect_error', handleError);

    return () => {
      socketInstance.off('connect', handleConnect);
      socketInstance.off('disconnect', handleDisconnect);
      socketInstance.off('connect_error', handleError);
    };
  }, [autoConnect, socket]);

  const createSocket = useCallback(() => {
    if (socket) return socket;
    const socketInstance = io(url, {
      reconnection,
      reconnectionDelay,
      reconnectionDelayMax,
      reconnectionAttempts,
      transports: ['websocket', 'polling'],
    });
    setSocket(socketInstance);
    return socketInstance;
  }, [socket, url, reconnection, reconnectionDelay, reconnectionDelayMax, reconnectionAttempts]);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    if (socket?.connected) {
      socket.emit(event, ...args);
    } else {
      console.warn(`Cannot emit event "${event}": socket not connected`);
    }
  }, [socket]);

  const on = useCallback((event: string, callback: SocketListener) => {
    if (!socket) {
      console.warn('Socket not initialized');
      return () => {};
    }

    socket.on(event, callback);

    // Return unsubscribe function
    return () => {
      socket.off(event, callback);
    };
  }, [socket]);

  const connect = useCallback(() => {
    const socketInstance = socket || createSocket();
    if (socketInstance && !socketInstance.connected) {
      socketInstance.connect();
    }
  }, [createSocket, socket]);

  const disconnect = useCallback(() => {
    if (socket?.connected) {
      socket.disconnect();
    }
  }, [socket]);

  return {
    socket,
    isConnected,
    connect,
    disconnect,
    emit,
    on,
  };
}
