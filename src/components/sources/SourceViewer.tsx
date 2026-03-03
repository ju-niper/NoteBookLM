import { useEffect, useRef, useState } from 'react';
import {
  X,
  FileText,
  Globe,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

import type { Document, DocumentContent } from '../../types';
import { documentsApi } from '../../api/documents';

interface Props {
  document: Document;
  onClose: () => void;
  /** When set, the viewer scrolls to and highlights this text passage. */
  highlightText?: string;
}

// ─── Highlighted content renderer ────────────────────────────────────────────

function HighlightedContent({
  rawContent,
  highlight,
}: {
  rawContent: string;
  highlight?: string;
}) {
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (markRef.current) {
      markRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlight]);

  if (!highlight) {
    return (
      <pre className='text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed'>
        {rawContent}
      </pre>
    );
  }

  // Use the first 150 chars of chunk_text as the search key (more reliable).
  const searchKey = highlight.slice(0, 150).trim();
  const idx = rawContent.indexOf(searchKey);

  if (idx === -1) {
    return (
      <pre className='text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed'>
        {rawContent}
      </pre>
    );
  }

  const end = Math.min(idx + highlight.length, rawContent.length);

  return (
    <pre className='text-xs whitespace-pre-wrap font-mono leading-relaxed text-gray-300'>
      {rawContent.slice(0, idx)}
      <mark
        ref={markRef as React.RefObject<HTMLElement>}
        className='bg-yellow-400/25 text-yellow-100 rounded-sm px-0.5 outline outline-1 outline-yellow-400/40'
      >
        {rawContent.slice(idx, end)}
      </mark>
      {rawContent.slice(end)}
    </pre>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SourceViewer({ document, onClose, highlightText }: Props) {
  const [content, setContent] = useState<DocumentContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setContent(null);

    documentsApi
      .getContent(document.id)
      .then(setContent)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [document.id]);

  return (
    <div className='flex flex-col h-full bg-[#16181a] border-r border-white/10 text-white w-[520px] flex-shrink-0'>
      {/* Header */}
      <div className='flex items-start gap-3 px-4 py-4 border-b border-white/10'>
        {document.file_type === 'web' ? (
          <Globe size={16} className='text-blue-400 mt-0.5 flex-shrink-0' />
        ) : (
          <FileText size={16} className='text-blue-400 mt-0.5 flex-shrink-0' />
        )}
        <div className='flex-1 min-w-0'>
          <p className='text-sm font-medium text-gray-100 leading-snug break-words line-clamp-2'>
            {document.filename}
          </p>
          {document.file_type === 'web' ? (
            <a
              href={document.file_path ?? '#'}
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-0.5 truncate'
            >
              <span className='truncate'>{document.file_path}</span>
              <ExternalLink size={10} className='flex-shrink-0' />
            </a>
          ) : (
            <p className='text-xs text-gray-500 mt-0.5 uppercase'>
              {document.file_type}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className='flex-shrink-0 text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10'
          aria-label='Close viewer'
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto px-4 py-4'>
        {loading && (
          <div className='flex items-center gap-2 text-gray-400 text-sm'>
            <Loader2 size={14} className='animate-spin' />
            Loading content...
          </div>
        )}

        {error && (
          <div className='flex items-center gap-2 text-red-400 text-sm'>
            <AlertCircle size={14} />
            Failed to load content.
          </div>
        )}

        {document.status === 'processing' && !loading && (
          <div className='flex items-center gap-2 text-yellow-400 text-sm'>
            <Loader2 size={14} className='animate-spin' />
            Document is still being processed...
          </div>
        )}

        {content?.raw_content && (
          <HighlightedContent
            rawContent={content.raw_content}
            highlight={highlightText}
          />
        )}

        {content && !content.raw_content && document.status === 'ready' && (
          <p className='text-sm text-gray-500 italic'>
            No text content could be extracted.
          </p>
        )}
      </div>
    </div>
  );
}
