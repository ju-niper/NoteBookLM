import client from './client';
import type { Session } from '../types';

export const sessionsApi = {
  list: () => client.get<Session[]>('/sessions').then((r) => r.data),
  get: (id: string) => client.get<Session>(`/sessions/${id}`).then((r) => r.data),
  create: (name: string) =>
    client.post<Session>('/sessions', { name }).then((r) => r.data),
  update: (id: string, name: string) =>
    client.patch<Session>(`/sessions/${id}`, { name }).then((r) => r.data),
  delete: (id: string) => client.delete(`/sessions/${id}`),
};
