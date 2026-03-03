export interface Session {
  id: string;
  name: string;
  summary: string | null;
  suggested_questions: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  session_id: string;
  filename: string;
  file_type: string;
  file_path?: string;
  status: 'processing' | 'ready' | 'error';
  created_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface DocumentContent {
  id: string;
  filename: string;
  raw_content: string;
}

export interface Citation {
  id: string;
  filename: string;
  document_id: string;
  chunk_index: number;
  chunk_text: string;
}
