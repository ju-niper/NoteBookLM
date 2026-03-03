import { useCallback, useRef, useState } from 'react';
import {
  Plus,
  Globe,
  Zap,
  ChevronDown,
  ExternalLink,
  Trash2,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Check,
  ThumbsUp,
  ThumbsDown,
  Search,
} from 'lucide-react';

import type { Document } from '../../types';
import { searchApi, type SearchResult } from '../../api/search';

import pdfIcon from '../../assets/pdf.png';
import docIcon from '../../assets/doc.png';
import docxIcon from '../../assets/docx.png';
import markdownIcon from '../../assets/markdown.png';
import pptxIcon from '../../assets/pptx.png';
import xlsIcon from '../../assets/xls.png';
import xlsxIcon from '../../assets/xlsx.png';
import documentIcon from '../../assets/document.png';

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchMode = 'web' | 'fast';
type UrlStatus = 'idle' | 'importing' | 'done' | 'error';

interface Props {
  sessionId: string | undefined;
  documents: Document[];
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: (id: string) => void;
  onSelect: (doc: Document) => void;
  onWebImported: () => void;
  selectedId: string | null;
  checkedDocIds: Set<string>;
  onToggleDoc: (id: string) => void;
  onToggleAll: () => void;
  hasSession: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function breadcrumb(doc: Document): string {
  if (doc.file_type === 'web') {
    try {
      return new URL(doc.file_path ?? '').hostname.replace(/^www\./, '');
    } catch {
      return 'Web page';
    }
  }
  const map: Record<string, string> = {
    pdf: 'PDF Document',
    docx: 'Word Document',
    doc: 'Word Document',
    txt: 'Text File',
    md: 'Markdown File',
    pptx: 'PowerPoint',
    xlsx: 'Excel Spreadsheet',
    xls: 'Excel Spreadsheet',
  };
  return map[doc.file_type] ?? 'Document';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Favicon({ url, fileType }: { url?: string; fileType?: string }) {
  const [err, setErr] = useState(false);

  // Use real website favicons for web links when possible
  if ((!fileType || fileType === 'web') && url && !err) {
    const host = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return '';
      }
    })();
    if (host)
      return (
        <img
          src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
          alt=''
          className='w-4 h-4 rounded-sm flex-shrink-0 object-cover'
          onError={() => setErr(true)}
        />
      );
  }

  const iconMap: Record<string, string> = {
    pdf: pdfIcon,
    doc: docIcon,
    docx: docxIcon,
    txt: markdownIcon,
    md: markdownIcon,
    pptx: pptxIcon,
    xls: xlsIcon,
    xlsx: xlsxIcon,
    web: documentIcon,
  };

  const src = fileType ? (iconMap[fileType] ?? documentIcon) : documentIcon;

  return (
    <img
      src={src}
      alt=''
      className='w-4 h-4 rounded-sm flex-shrink-0 object-contain bg-gray-100'
    />
  );
}

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`w-[18px] h-[18px] rounded flex items-center justify-center border transition-colors cursor-pointer flex-shrink-0 ${
        checked
          ? 'bg-blue-600 border-blue-600'
          : 'border-gray-300 hover:border-gray-400 bg-white'
      }`}
    >
      {checked && <Check size={11} className='text-white' strokeWidth={3} />}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SourcePanel({
  sessionId,
  documents,
  uploading,
  onUpload,
  onDelete,
  onSelect,
  onWebImported,
  selectedId,
  checkedDocIds,
  onToggleDoc,
  onToggleAll,
  hasSession,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Search state
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('fast');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [lastQuery, setLastQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Per-URL import tracking
  const [urlStatus, setUrlStatus] = useState<Record<string, UrlStatus>>({});
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q || searching || !hasSession) return;
    setSearching(true);
    setHasSearched(false);
    setResults([]);
    setExpanded(false);
    setSelectedUrls(new Set());
    setUrlStatus({});
    setLastQuery(q);
    try {
      const data = await searchApi.webSearch(q);
      setResults(data.results);
      setSelectedUrls(new Set(data.results.map((r) => r.url)));
    } catch {
      setResults([]);
    } finally {
      setHasSearched(true);
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setHasSearched(false);
    setResults([]);
    setLastQuery('');
    setExpanded(false);
    setSelectedUrls(new Set());
    setUrlStatus({});
  };

  const toggleUrl = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  };

  const toggleAllUrls = () => {
    const importable = results.filter((r) => urlStatus[r.url] !== 'done');
    const allSel = importable.every((r) => selectedUrls.has(r.url));
    setSelectedUrls(allSel ? new Set() : new Set(importable.map((r) => r.url)));
  };

  const doImport = async (items: SearchResult[]) => {
    if (!sessionId || importing) return;
    const toImport = items.filter((r) => urlStatus[r.url] !== 'done');
    if (!toImport.length) return;
    setImporting(true);
    toImport.forEach((r) =>
      setUrlStatus((prev) => ({ ...prev, [r.url]: 'importing' })),
    );
    try {
      await searchApi.importUrls(
        sessionId,
        toImport.map((r) => ({ url: r.url, title: r.title })),
      );
      toImport.forEach((r) =>
        setUrlStatus((prev) => ({ ...prev, [r.url]: 'done' })),
      );
      onWebImported();
    } catch {
      toImport.forEach((r) =>
        setUrlStatus((prev) => ({ ...prev, [r.url]: 'error' })),
      );
    } finally {
      setImporting(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(onUpload);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [onUpload],
  );

  const top3 = results.slice(0, 3);
  const moreCount = Math.max(0, results.length - 3);
  const importableCount = results.filter(
    (r) => urlStatus[r.url] !== 'done',
  ).length;
  const allDocsChecked =
    documents.length > 0 && documents.every((d) => checkedDocIds.has(d.id));

  return (
    <div
      className='flex flex-col h-full bg-white text-gray-900'
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className='flex items-center justify-between px-4 py-3.5 border-b border-gray-100 flex-shrink-0'>
        <h2 className='font-semibold text-base text-gray-800'>Sources</h2>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────── */}
      <div className='flex-1 overflow-y-auto'>
        <div className='p-3 space-y-2.5'>
          {/* Add sources button */}
          <button
            disabled={!hasSession || uploading}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              dragging
                ? 'border-blue-400 bg-blue-50 text-blue-600'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {uploading ? (
              <Loader2 size={15} className='animate-spin' />
            ) : (
              <Plus size={15} />
            )}
            {dragging ? 'Drop files to add' : 'Add sources'}
          </button>
          <input
            ref={fileInputRef}
            type='file'
            multiple
            className='hidden'
            accept='.pdf,.docx,.doc,.txt,.md,.pptx,.xlsx,.xls'
            onChange={(e) => handleFiles(e.target.files)}
          />

          {/* ── AI Search card ────────────────────────────────────────── */}
          <div
            className={`rounded-xl border overflow-hidden transition-colors ${
              hasSearched ? 'border-gray-200' : 'border-gray-200'
            }`}
          >
            {/* Search input row */}
            <div className='flex gap-2 px-3 pt-2.5 pb-1'>
              <div className='flex p-1'>
                <Search size={16} className='text-gray-400 flex-shrink-0' />
              </div>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder='Search the web for new sources'
                rows={3}
                disabled={!hasSession || searching}
                className='flex-1 max-h-[50px] text-sm text-gray-700 placeholder-gray-400 outline-none bg-transparent disabled:opacity-50 py-0.5'
              />
            </div>

            {/* Mode pills + submit */}
            <div className='flex items-center gap-2 px-3 pb-2.5'>
              <button
                onClick={() => setMode((m) => (m === 'web' ? 'fast' : 'web'))}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  mode === 'web'
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Globe size={11} />
                &nbsp;Web
                <ChevronDown size={10} />
              </button>
              <button
                onClick={() => setMode((m) => (m === 'fast' ? 'web' : 'fast'))}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  mode === 'fast'
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Zap size={11} />
                &nbsp;Fast Research
                <ChevronDown size={10} />
              </button>
              <button
                onClick={handleSearch}
                disabled={!query.trim() || !hasSession || searching}
                className='ml-auto w-7 h-7 flex-shrink-0 rounded-full bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors'
              >
                {searching ? (
                  <Loader2 size={12} className='animate-spin text-white' />
                ) : (
                  <ArrowRight size={12} className='text-white' />
                )}
              </button>
            </div>
          </div>

          {/* ── Results card ──────────────────────────────────────────── */}
          {(hasSearched || searching) && (
            <div className='rounded-xl border border-gray-200 overflow-hidden'>
              {/* Card header */}
              <div className='flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100'>
                <div className='flex items-center gap-1.5'>
                  <Zap size={13} className='text-purple-500 flex-shrink-0' />
                  <span className='text-xs font-semibold text-gray-800'>
                    {searching
                      ? 'Searching…'
                      : `${mode === 'fast' ? 'Fast Research' : 'Web Search'} completed!`}
                  </span>
                </div>
                {!searching && results.length > 0 && (
                  <button
                    onClick={() => setExpanded((e) => !e)}
                    className='text-xs font-semibold text-blue-600 hover:text-blue-700'
                  >
                    {expanded ? 'Collapse' : 'View'}
                  </button>
                )}
              </div>

              {/* Quick overview — top 3 results */}
              {!searching && results.length > 0 && (
                <div className='px-3 py-2 space-y-2.5'>
                  {top3.map((r) => (
                    <div key={r.url} className='flex items-start gap-2'>
                      <Favicon url={r.url} />
                      <div className='flex-1 min-w-0'>
                        <p className='text-xs font-medium text-gray-800 truncate'>
                          {r.title || r.url}
                        </p>
                        <p className='text-xs text-blue-600 truncate'>
                          {(() => {
                            try {
                              return new URL(r.url).hostname;
                            } catch {
                              return '';
                            }
                          })()}
                        </p>
                        {r.snippet && (
                          <p className='text-xs text-gray-500 line-clamp-1 mt-0.5'>
                            {r.snippet}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {moreCount > 0 && (
                    <button
                      onClick={() => setExpanded(true)}
                      className='flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium'
                    >
                      <ExternalLink size={11} />
                      {moreCount} more source{moreCount > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              )}

              {!searching && results.length === 0 && (
                <p className='px-3 py-3 text-xs text-gray-500'>
                  No results found for "{lastQuery}".
                </p>
              )}

              {/* Action row */}
              {!searching && results.length > 0 && (
                <div className='flex items-center gap-2 px-3 py-2 border-t border-gray-100'>
                  <button className='text-gray-400 hover:text-green-500 transition-colors p-0.5'>
                    <ThumbsUp size={14} />
                  </button>
                  <button className='text-gray-400 hover:text-red-400 transition-colors p-0.5'>
                    <ThumbsDown size={14} />
                  </button>
                  <div className='w-px h-4 bg-gray-200 mx-0.5' />
                  <div className='flex flex-grow items-center justify-end gap-2'>
                    <button
                      onClick={clearSearch}
                      className='text-xs text-gray-500 hover:text-red-500 transition-colors'
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => doImport(results)}
                      disabled={importing || importableCount === 0}
                      className='flex cursor-pointer items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-full text-xs font-semibold text-white transition-colors'
                    >
                      {importing ? (
                        <Loader2 size={11} className='animate-spin' />
                      ) : (
                        <Plus size={11} />
                      )}
                      Import
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded list */}
              {expanded && results.length > 0 && (
                <div className='border-t border-gray-100'>
                  {/* Select all row */}
                  <div
                    className='flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-gray-50 border-b border-gray-100'
                    onClick={toggleAllUrls}
                  >
                    <span className='text-xs font-semibold text-gray-700'>
                      Select all sources
                    </span>
                    <Checkbox
                      checked={results
                        .filter((r) => urlStatus[r.url] !== 'done')
                        .every((r) => selectedUrls.has(r.url))}
                      onChange={toggleAllUrls}
                    />
                  </div>

                  {/* Each result row */}
                  {results.map((r) => {
                    const status = urlStatus[r.url];
                    const isDone = status === 'done';
                    const isImporting = status === 'importing';
                    const isErr = status === 'error';

                    return (
                      <div
                        key={r.url}
                        onClick={() =>
                          !isDone && !isImporting && toggleUrl(r.url)
                        }
                        className='flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-b-0 cursor-pointer'
                      >
                        <Favicon url={r.url} />
                        <div className='flex-1 min-w-0'>
                          <p className='text-xs font-medium text-gray-800 truncate'>
                            {r.title || r.url}
                          </p>
                          <p className='text-xs text-gray-400 truncate'>
                            {(() => {
                              try {
                                return new URL(r.url).hostname;
                              } catch {
                                return r.url;
                              }
                            })()}
                          </p>
                        </div>
                        <a
                          href={r.url}
                          target='_blank'
                          rel='noopener noreferrer'
                          onClick={(e) => e.stopPropagation()}
                          className='text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0 p-0.5'
                        >
                          <ExternalLink size={12} />
                        </a>
                        <div className='flex-shrink-0'>
                          {isDone ? (
                            <CheckCircle2
                              size={16}
                              className='text-green-500'
                            />
                          ) : isImporting ? (
                            <Loader2
                              size={16}
                              className='animate-spin text-blue-500'
                            />
                          ) : isErr ? (
                            <AlertCircle size={16} className='text-red-400' />
                          ) : (
                            <Checkbox
                              checked={selectedUrls.has(r.url)}
                              onChange={() => toggleUrl(r.url)}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Import selected */}
                  {selectedUrls.size > 0 && (
                    <div className='px-3 py-2.5 border-t border-gray-100'>
                      <button
                        onClick={() =>
                          doImport(
                            results.filter((r) => selectedUrls.has(r.url)),
                          )
                        }
                        disabled={importing}
                        className='w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl text-xs font-semibold text-white transition-colors'
                      >
                        {importing ? (
                          <Loader2 size={11} className='animate-spin' />
                        ) : (
                          <Plus size={11} />
                        )}
                        Import {selectedUrls.size} selected
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sources list ──────────────────────────────────────────────── */}
        {documents.length > 0 ? (
          <div className='px-3 pb-4'>
            {/* Select all row */}
            <div
              className='flex items-center justify-between py-2 px-1 cursor-pointer'
              onClick={onToggleAll}
            >
              <span className='text-xs font-semibold text-gray-600'>
                Select all sources
              </span>
              <Checkbox checked={allDocsChecked} onChange={onToggleAll} />
            </div>

            {/* Items */}
            <div className='space-y-0.5'>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => onSelect(doc)}
                  className={`group flex items-center gap-2.5 px-2 py-2 rounded-xl cursor-pointer transition-colors ${
                    selectedId === doc.id ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <Favicon url={doc.file_path} fileType={doc.file_type} />

                  <div className='flex-1 min-w-0'>
                    <p
                      className={`text-xs font-medium truncate ${selectedId === doc.id ? 'text-indigo-700' : 'text-gray-800'}`}
                    >
                      {doc.filename}
                    </p>
                    {/* breadcrumb */}
                    <p className='text-xs text-gray-400 truncate'>
                      {breadcrumb(doc)}
                    </p>
                  </div>

                  <div className='flex items-center gap-1.5 flex-shrink-0'>
                    {doc.status === 'processing' && (
                      <Loader2
                        size={12}
                        className='animate-spin text-blue-500'
                      />
                    )}
                    {doc.status === 'error' && (
                      <AlertCircle size={12} className='text-red-400' />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(doc.id);
                      }}
                      className='opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all p-0.5 rounded'
                    >
                      <Trash2 size={12} />
                    </button>
                    <Checkbox
                      checked={checkedDocIds.has(doc.id)}
                      onChange={() => onToggleDoc(doc.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          !hasSearched &&
          !searching && (
            <div className='flex flex-col items-center justify-center py-14 px-6 text-center gap-3'>
              <div className='w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center'>
                <svg
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='1.5'
                  className='w-7 h-7 text-gray-400'
                >
                  <path
                    d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
              </div>
              <div>
                <p className='text-sm font-medium text-gray-600'>
                  Saved sources will appear here
                </p>
                <p className='text-xs text-gray-400 mt-1 leading-relaxed'>
                  Click Add sources above to add PDFs, docs, or text files. Or
                  search the web above.
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
