import client from './client';
import type { Document, DocumentContent } from '../types';

export const documentsApi = {
  list: (sessionId: string) =>
    client.get<Document[]>(`/documents/${sessionId}`).then((r) => r.data),

  upload: (sessionId: string, file: File) => {
    const form = new FormData();
    form.append('session_id', sessionId);
    form.append('file', file);
    return client
      .post<Document>('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  getContent: (documentId: string) =>
    client
      .get<DocumentContent>(`/documents/${documentId}/content`)
      .then((r) => r.data),

  delete: (documentId: string) => client.delete(`/documents/${documentId}`),
};
