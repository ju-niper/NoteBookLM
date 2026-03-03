import { useState, useEffect, useCallback } from 'react';
import type { Document } from '../types';
import { documentsApi } from '../api/documents';

export function useDocuments(
  sessionId: string | undefined,
  onDocumentReady?: () => void,
) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    if (!sessionId) {
      setDocuments([]);
      return;
    }
    const data = await documentsApi.list(sessionId);
    setDocuments(data);
  }, [sessionId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!sessionId) return;
      setUploading(true);
      try {
        const doc = await documentsApi.upload(sessionId, file);
        setDocuments((prev) => [doc, ...prev]);

        // Poll until the document leaves the 'processing' state.
        // After it becomes 'ready' the backend still runs a background LLM call
        // (~5-8 s) to generate the welcome summary + follow-up questions.
        // We fire two refreshes: one immediately (updates doc status) and one
        // 9 seconds later (picks up the welcome message once it is saved).
        const poll = setInterval(async () => {
          const latest = await documentsApi.list(sessionId);
          setDocuments(latest);
          const target = latest.find((d) => d.id === doc.id);
          if (target && target.status === 'ready') {
            onDocumentReady?.();                          // immediate refresh
            setTimeout(() => onDocumentReady?.(), 9000); // delayed refresh
            clearInterval(poll);
          } else if (target && target.status === 'error') {
            clearInterval(poll);
          }
        }, 2000);
        setTimeout(() => clearInterval(poll), 120_000);
      } finally {
        setUploading(false);
      }
    },
    [sessionId, onDocumentReady],
  );

  const deleteDocument = useCallback(async (documentId: string) => {
    await documentsApi.delete(documentId);
    setDocuments((prev) => prev.filter((d) => d.id !== documentId));
  }, []);

  return {
    documents,
    uploading,
    uploadFile,
    deleteDocument,
    refresh: fetchDocuments,
  };
}
