import client from './client';
import type { Message } from '../types';

export const chatApi = {
  getHistory: (sessionId: string) =>
    client.get<Message[]>(`/chat/history/${sessionId}`).then(r => r.data),

  clearHistory: (sessionId: string) =>
    client.delete(`/chat/history/${sessionId}`),

  sendMessage: async (
    sessionId: string,
    content: string,
    onToken: (token: string) => void,
    documentIds?: string[],
  ): Promise<void> => {
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        content,
        document_ids: documentIds?.length ? documentIds : null,
      }),
    });

    if (!response.ok) throw new Error('Chat request failed');
    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onToken(decoder.decode(value, { stream: true }));
    }
  },
};
