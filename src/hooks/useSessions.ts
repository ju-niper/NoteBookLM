import { useState, useEffect, useCallback } from 'react';
import type { Session } from '../types';
import { sessionsApi } from '../api/sessions';

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await sessionsApi.list();
      setSessions(data);
      if (data.length > 0 && !activeSession) {
        setActiveSession(data[0]);
      }
    } finally {
      setLoading(false);
    }
  }, [activeSession]);

  useEffect(() => {
    fetchSessions();
  }, []);

  const createSession = useCallback(async (name: string) => {
    const session = await sessionsApi.create(name);
    setSessions((prev) => [session, ...prev]);
    setActiveSession(session);
    return session;
  }, []);

  const renameSession = useCallback(
    async (id: string, name: string) => {
      const updated = await sessionsApi.update(id, name);
      setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)));
      if (activeSession?.id === id) setActiveSession(updated);
    },
    [activeSession],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      await sessionsApi.delete(id);
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== id);
        if (activeSession?.id === id) {
          setActiveSession(remaining[0] ?? null);
        }
        return remaining;
      });
    },
    [activeSession],
  );

  const refreshActiveSession = useCallback(async () => {
    if (!activeSession) return;
    try {
      const updated = await sessionsApi.get(activeSession.id);
      setActiveSession(updated);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch {
      // ignore transient errors
    }
  }, [activeSession]);

  return {
    sessions,
    activeSession,
    setActiveSession,
    loading,
    createSession,
    renameSession,
    deleteSession,
    refresh: fetchSessions,
    refreshActiveSession,
  };
}
