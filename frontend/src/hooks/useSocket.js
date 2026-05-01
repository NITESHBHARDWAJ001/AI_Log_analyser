import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

export const useSocket = (projectId, handlers = {}) => {
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!projectId) return;

    const token = localStorage.getItem('aq_token');
    const socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-project', projectId);
    });

    socket.on('log-update', (data) => handlersRef.current.onLog?.(data));
    socket.on('metrics-update', (data) => handlersRef.current.onMetric?.(data));
    socket.on('issue-detected', (data) => handlersRef.current.onIssue?.(data));
    socket.on('alert-new', (data) => handlersRef.current.onAlert?.(data));
    socket.on('health-update', (data) => handlersRef.current.onHealth?.(data));
    socket.on('ai-analysis-request', (data) => handlersRef.current.onAiRequest?.(data));
    socket.on('report-generated', (data) => handlersRef.current.onReport?.(data));

    socket.on('disconnect', () => console.log('Socket disconnected'));

    return () => {
      socket.emit('leave-project', projectId);
      socket.disconnect();
    };
  }, [projectId]);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit, socket: socketRef.current };
};
