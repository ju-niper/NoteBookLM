import { useState, useEffect, useCallback } from 'react';
import type { Message } from '../types';
import { chatApi } from '../api/chat';

export function useChat(
  sessionId: string | undefined,
  documentIds?: string[],
  /** Increment this to force a message list refresh (e.g. after a doc is processed). */
  refreshTrigger = 0,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    chatApi
      .getHistory(sessionId)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [sessionId, refreshTrigger]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || streaming) return;

      setMessages((prev) => [
        ...prev,
        {
          id: `temp-user-${Date.now()}`,
          session_id: sessionId,
          role: 'user',
          content,
          created_at: new Date().toISOString(),
        },
      ]);
      setStreaming(true);
      setStreamingContent('');

      try {
        let accumulated = '';
        await chatApi.sendMessage(
          sessionId,
          content,
          (token) => {
            accumulated += token;
            setStreamingContent(accumulated);
          },
          documentIds,
        );

        setMessages((prev) => [
          ...prev,
          {
            id: `temp-assistant-${Date.now()}`,
            session_id: sessionId,
            role: 'assistant',
            content: accumulated,
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setStreaming(false);
        setStreamingContent('');
      }
    },
    [sessionId, streaming, documentIds],
  );

  const clearHistory = useCallback(async () => {
    if (!sessionId) return;
    await chatApi.clearHistory(sessionId);
    setMessages([]);
  }, [sessionId]);

  return { messages, streaming, streamingContent, sendMessage, clearHistory };
}
