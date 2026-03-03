import { useState, useEffect, useCallback } from 'react';
import { BookOpen } from 'lucide-react';
import SessionSelector from './components/sessions/SessionSelector';
import SourcePanel from './components/sources/SourcePanel';
import SourceViewer from './components/sources/SourceViewer';
import ChatPanel from './components/chat/ChatPanel';
import { useSessions } from './hooks/useSessions';
import { useDocuments } from './hooks/useDocuments';
import { useChat } from './hooks/useChat';
import type { Citation, Document } from './types';

export default function App() {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null,
  );
  const [viewerHighlight, setViewerHighlight] = useState<string | undefined>();
  const [checkedDocIds, setCheckedDocIds] = useState<Set<string>>(new Set());
  // Incrementing this causes useChat to re-fetch history (used after a doc is ready)
  const [msgRefreshTrigger, setMsgRefreshTrigger] = useState(0);

  const {
    sessions,
    activeSession,
    setActiveSession,
    loading,
    createSession,
    renameSession,
    deleteSession,
    refreshActiveSession,
  } = useSessions();

  // Called by useDocuments polling when a document transitions to 'ready'.
  // 1. Immediately bump the message-refresh trigger so the UI re-fetches history.
  // 2. After 9 s the backend LLM call for the session overview will have
  //    completed — re-fetch again + reload the active session to pick up the
  //    new summary / suggested_questions.
  const handleDocumentReady = useCallback(() => {
    setMsgRefreshTrigger((n) => n + 1);
    setTimeout(() => {
      setMsgRefreshTrigger((n) => n + 1);
      refreshActiveSession();
    }, 9000);
  }, [refreshActiveSession]);

  const {
    documents,
    uploading,
    uploadFile,
    deleteDocument,
    refresh: refreshDocuments,
  } = useDocuments(activeSession?.id, handleDocumentReady);

  // Auto-check newly added documents; remove stale IDs
  useEffect(() => {
    setCheckedDocIds((prev) => {
      const next = new Set(prev);
      documents.forEach((d) => {
        if (!next.has(d.id)) next.add(d.id);
      });
      next.forEach((id) => {
        if (!documents.find((d) => d.id === id)) next.delete(id);
      });
      return next;
    });
  }, [documents]);

  const toggleDoc = (id: string) => {
    setCheckedDocIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllDocs = () => {
    const allChecked = documents.every((d) => checkedDocIds.has(d.id));
    setCheckedDocIds(
      allChecked ? new Set() : new Set(documents.map((d) => d.id)),
    );
  };

  const { messages, streaming, streamingContent, sendMessage, clearHistory } =
    useChat(activeSession?.id, [...checkedDocIds], msgRefreshTrigger);

  const handleSelectDocument = (doc: Document) => {
    if (selectedDocument?.id === doc.id) {
      setSelectedDocument(null);
      setViewerHighlight(undefined);
    } else {
      setSelectedDocument(doc);
      setViewerHighlight(undefined);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (selectedDocument?.id === id) {
      setSelectedDocument(null);
      setViewerHighlight(undefined);
    }
    await deleteDocument(id);
  };

  // Citation badge clicked → open the referenced document and scroll to chunk
  const handleCitationClick = (citation: Citation) => {
    const doc = documents.find((d) => d.id === citation.document_id);
    if (doc) {
      setSelectedDocument(doc);
      setViewerHighlight(citation.chunk_text);
    }
  };

  // Always use the freshest document record from the list
  const viewerDocument = selectedDocument
    ? (documents.find((d) => d.id === selectedDocument.id) ?? selectedDocument)
    : null;

  if (loading) {
    return (
      <div className='h-screen flex items-center justify-center bg-gray-900'>
        <div className='flex items-center gap-3 text-white'>
          <BookOpen size={24} className='animate-pulse' />
          <span className='text-lg'>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className='h-screen flex flex-col bg-gray-900'>
      {/* Header */}
      <header className='flex items-center gap-4 px-4 py-3 bg-[#1a1b1c] border-b border-white/10 flex-shrink-0'>
        <div className='flex items-center gap-2 text-white'>
          <div className='w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center'>
            <BookOpen size={15} />
          </div>
          <span className='font-semibold text-sm'>NotebookLM</span>
        </div>
        <div className='w-px h-5 bg-white/20' />
        <SessionSelector
          sessions={sessions}
          activeSession={activeSession}
          onSelect={setActiveSession}
          onCreate={createSession}
          onRename={renameSession}
          onDelete={deleteSession}
        />
      </header>

      {/* Main layout */}
      <div className='flex flex-1 overflow-hidden'>
        {/* Sources panel */}
        <div className='w-[350px] xl:w-[480px] flex-shrink-0 border-r border-gray-200 overflow-hidden flex flex-col'>
          <SourcePanel
            sessionId={activeSession?.id}
            documents={documents}
            uploading={uploading}
            onUpload={uploadFile}
            onDelete={handleDeleteDocument}
            onSelect={handleSelectDocument}
            onWebImported={refreshDocuments}
            selectedId={selectedDocument?.id ?? null}
            checkedDocIds={checkedDocIds}
            onToggleDoc={toggleDoc}
            onToggleAll={toggleAllDocs}
            hasSession={!!activeSession}
          />
        </div>

        {/* Chat panel */}
        <div className='flex-1 overflow-hidden flex flex-col min-w-0'>
          <ChatPanel
            messages={messages}
            streaming={streaming}
            streamingContent={streamingContent}
            onSend={sendMessage}
            onClear={clearHistory}
            hasSession={!!activeSession}
            hasDocuments={documents.some(
              (d) => d.status === 'ready' && checkedDocIds.has(d.id),
            )}
            onCitationClick={handleCitationClick}
            sessionTitle={activeSession?.name ?? null}
            sessionSummary={activeSession?.summary ?? null}
            sessionQuestions={activeSession?.suggested_questions ?? null}
          />
        </div>

        {/* Source viewer — third panel, slides in when a document is selected */}
        {viewerDocument && (
          <SourceViewer
            document={viewerDocument}
            onClose={() => {
              setSelectedDocument(null);
              setViewerHighlight(undefined);
            }}
            highlightText={viewerHighlight}
          />
        )}
      </div>
    </div>
  );
}
