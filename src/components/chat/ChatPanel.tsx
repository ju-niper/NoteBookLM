import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Send,
  Trash2,
  Loader2,
  User,
  BookOpen,
  FileText,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

import type { Citation, Message } from '../../types';

// Must stay in sync with the backend constants in agent.py
const CITATIONS_DELIMITER = '\n\n__CITATIONS_JSON__\n';
const FOLLOWUPS_DELIMITER = '\n\n__FOLLOWUPS_JSON__\n';

// ─── Parsing helpers ──────────────────────────────────────────────────────────

interface ParsedMessage {
  answer: string;
  citations: Citation[];
  followups: string[];
}

function parseMessage(content: string): ParsedMessage {
  let text = content;
  let followups: string[] = [];

  const fIdx = text.indexOf(FOLLOWUPS_DELIMITER);
  if (fIdx !== -1) {
    try {
      followups = JSON.parse(text.slice(fIdx + FOLLOWUPS_DELIMITER.length));
    } catch {
      followups = [];
    }
    text = text.slice(0, fIdx);
  }

  const cIdx = text.indexOf(CITATIONS_DELIMITER);
  if (cIdx === -1) return { answer: text, citations: [], followups };

  try {
    return {
      answer: text.slice(0, cIdx),
      citations: JSON.parse(text.slice(cIdx + CITATIONS_DELIMITER.length)),
      followups,
    };
  } catch {
    return { answer: text.slice(0, cIdx), citations: [], followups };
  }
}

function visibleStreamingContent(content: string): string {
  const cIdx = content.indexOf(CITATIONS_DELIMITER);
  return cIdx !== -1 ? content.slice(0, cIdx) : content;
}

// ─── Remark plugin: convert [n] text patterns → inlineCode AST nodes ─────────
//
// Doing this at the MDAST level (not by string-replacing backticks) ensures
// that adjacent citations like [1][4] each become their own independent
// inlineCode node. String-level backtick replacement would turn [1][4] into
// `citation:1``citation:4` which CommonMark parses as ONE double-backtick
// code span, breaking the custom renderer.

const remarkCitationPlugin = () => (tree: any) => {
  const walkNode = (node: any): void => {
    if (!Array.isArray(node.children)) return;

    let i = 0;
    while (i < node.children.length) {
      const child = node.children[i];

      if (child.type === 'text' && /\[\d+\]/.test(child.value)) {
        // Split e.g. "text [1][4] more" → ["text ", "[1]", "[4]", " more"]
        const parts: string[] = child.value.split(/(\[\d+\])/g).filter(Boolean);
        const newNodes = parts.map((p: string) => {
          const m = p.match(/^\[(\d+)\]$/);
          if (m) return { type: 'inlineCode', value: `citation:${m[1]}` };
          return { type: 'text', value: p };
        });
        node.children.splice(i, 1, ...newNodes);
        i += newNodes.length;
      } else {
        walkNode(child);
        i++;
      }
    }
  };
  walkNode(tree);
};

// Stable reference — defined at module scope so ReactMarkdown doesn't re-parse
// the markdown on every render.
const REMARK_PLUGINS = [remarkCitationPlugin];

// ─── Citation badge + popover ─────────────────────────────────────────────────

function CitationBadge({
  displayNum,
  citation,
  onViewSource,
}: {
  displayNum: string;
  citation: Citation;
  onViewSource: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <span ref={ref} className='relative inline-block align-middle mx-0.5'>
      <button
        onClick={() => setOpen((o) => !o)}
        className='inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full border border-blue-200 hover:bg-blue-200 transition-colors leading-none'
        title={`Source ${displayNum}: ${citation.filename}`}
      >
        {displayNum}
      </button>

      {open && (
        <div className='absolute bottom-full left-0 mb-2 z-50 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 text-left'>
          <div className='absolute -bottom-1.5 left-3 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45' />

          <div className='flex items-start gap-2 mb-2'>
            <FileText
              size={13}
              className='text-blue-500 flex-shrink-0 mt-0.5'
            />
            <p className='text-xs font-semibold text-gray-800 leading-snug line-clamp-2'>
              {citation.filename}
            </p>
            <button
              onClick={() => setOpen(false)}
              className='ml-auto flex-shrink-0 text-gray-300 hover:text-gray-500'
            >
              <X size={12} />
            </button>
          </div>

          <p className='text-[11px] text-gray-500 leading-relaxed line-clamp-4 bg-gray-50 rounded-lg px-2 py-1.5 font-mono'>
            {citation.chunk_text}
          </p>

          <button
            onClick={() => {
              onViewSource();
              setOpen(false);
            }}
            className='mt-2 w-full text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors text-center'
          >
            View in source →
          </button>
        </div>
      )}
    </span>
  );
}

// ─── Answer renderer ──────────────────────────────────────────────────────────

function AnswerContent({
  answer,
  citations,
  onViewSource,
}: {
  answer: string;
  citations: Citation[];
  onViewSource: (c: Citation) => void;
}) {
  // Map original citation id → sequential display number (order of first appearance).
  // e.g. if the answer uses [1] then [4], they show as ① and ②.
  const seqMap = useMemo(() => {
    const map = new Map<string, string>();
    let counter = 0;
    const pattern = /\[(\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(answer)) !== null) {
      const id = m[1];
      if (!map.has(id) && citations.some((c) => c.id === id)) {
        map.set(id, String(++counter));
      }
    }
    return map;
  }, [answer, citations]);

  return (
    <div className='prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2'>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        components={{
          // The remark plugin converted [n] → inlineCode("citation:n").
          // Here we intercept those and render CitationBadge instead.
          code({ children }) {
            const text = String(children).trim();
            if (text.startsWith('citation:')) {
              const id = text.replace('citation:', '');
              const citation = citations.find((c) => c.id === id);
              if (citation) {
                const displayNum = seqMap.get(id) ?? id;
                return (
                  <CitationBadge
                    displayNum={displayNum}
                    citation={citation}
                    onViewSource={() => onViewSource(citation)}
                  />
                );
              }
            }
            return <code>{children}</code>;
          },
        }}
      >
        {answer}
      </ReactMarkdown>
    </div>
  );
}

// ─── Follow-up question chips ─────────────────────────────────────────────────

function FollowUpChips({
  questions,
  onSend,
  disabled,
}: {
  questions: string[];
  onSend: (q: string) => void;
  disabled: boolean;
}) {
  if (!questions.length) return null;
  return (
    <div className='mt-3 flex flex-col gap-2'>
      {questions.map((q, i) => (
        <button
          key={i}
          onClick={() => !disabled && onSend(q)}
          disabled={disabled}
          className='flex items-center gap-2 text-left text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed border border-blue-200 rounded-xl px-3 py-2 transition-colors group'
          title={q}
        >
          <span className='flex-shrink-0 w-4 h-4 rounded-full bg-blue-200 group-hover:bg-blue-300 flex items-center justify-center text-[9px] font-bold text-blue-700 transition-colors'>
            {i + 1}
          </span>
          <span className='leading-snug'>{q}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Message bubbles ──────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onCitationClick,
  onChipSend,
  chipsDisabled,
}: {
  message: Message;
  onCitationClick: (citation: Citation) => void;
  onChipSend: (q: string) => void;
  chipsDisabled: boolean;
}) {
  const isUser = message.role === 'user';
  const { answer, citations, followups } = parseMessage(message.content);

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          isUser ? 'bg-blue-600' : 'bg-gray-700'
        }`}
      >
        {isUser ? (
          <User size={18} className='text-white' />
        ) : (
          <BookOpen size={18} className='text-white' />
        )}
      </div>

      <div className={`max-w-[80%] ${isUser ? '' : 'flex-1 min-w-0'}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-gray-100 text-gray-800 rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p className='text-base whitespace-pre-wrap'>{message.content}</p>
          ) : (
            <div className='text-base'>
              <AnswerContent
                answer={answer}
                citations={citations}
                onViewSource={onCitationClick}
              />
            </div>
          )}
        </div>

        {!isUser && (
          <FollowUpChips
            questions={followups}
            onSend={onChipSend}
            disabled={chipsDisabled}
          />
        )}
      </div>
    </div>
  );
}

function StreamingBubble({ content }: { content: string }) {
  const visible = visibleStreamingContent(content);
  return (
    <div className='flex gap-3'>
      <div className='flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center'>
        <BookOpen size={14} className='text-white' />
      </div>
      <div className='max-w-[80%] bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3'>
        <div className='text-sm prose prose-sm max-w-none prose-p:my-1'>
          {visible ? (
            <ReactMarkdown>{visible}</ReactMarkdown>
          ) : (
            <span className='flex gap-1 items-center text-gray-400'>
              <Loader2 size={14} className='animate-spin' /> Thinking...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface Props {
  messages: Message[];
  streaming: boolean;
  streamingContent: string;
  onSend: (content: string) => void;
  onClear: () => void;
  hasSession: boolean;
  hasDocuments: boolean;
  onCitationClick: (citation: Citation) => void;
  sessionTitle: string | null;
  sessionSummary: string | null;
  sessionQuestions: string[] | null;
}

export default function ChatPanel({
  messages,
  streaming,
  streamingContent,
  onSend,
  onClear,
  hasSession,
  hasDocuments,
  onCitationClick,
  sessionTitle,
  sessionSummary,
  sessionQuestions,
}: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const canSend = hasSession && hasDocuments;

  const handleSend = (text: string = input.trim()) => {
    if (!text || streaming || !canSend) return;
    onSend(text);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  return (
    <div className='flex flex-col h-full bg-white'>
      <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
        <h2 className='text-sm font-semibold text-gray-500 uppercase tracking-wider'>
          Chat
        </h2>
        {messages.length > 0 && (
          <button
            onClick={onClear}
            className='flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors'
          >
            <Trash2 size={13} />
            Clear
          </button>
        )}
      </div>

      <div className='flex-1 overflow-y-auto px-6 py-4'>
        {/* ── Session overview card ── */}
        {sessionSummary && (
          <div className='mb-6 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 px-6 py-5'>
            <p className='text-[11px] font-semibold uppercase tracking-widest text-blue-500 mb-1.5'>
              Notebook Summary
            </p>
            <h3 className='text-xl font-semibold text-gray-900 leading-tight mb-3'>
              {sessionTitle || 'Untitled Notebook'}
            </h3>
            <p className='text-base text-gray-700 leading-relaxed'>
              {sessionSummary}
            </p>

            {sessionQuestions && sessionQuestions.length > 0 && (
              <div className='mt-5'>
                <p className='text-[11px] font-semibold uppercase tracking-widest text-blue-400 mb-2'>
                  Suggested questions
                </p>
                <div className='flex flex-col gap-2'>
                  {sessionQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => !streaming && canSend && handleSend(q)}
                      disabled={!canSend || streaming}
                      className='flex items-center gap-2 text-left text-sm text-blue-700 bg-white/70 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed border border-blue-200 rounded-xl px-3 py-2.5 transition-colors group'
                    >
                      <span className='flex-shrink-0 w-4 h-4 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center text-[9px] font-bold text-blue-600 transition-colors'>
                        {i + 1}
                      </span>
                      <span className='leading-snug'>{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {messages.length === 0 && !streaming && !sessionSummary && (
          <div className='flex flex-col items-center justify-center h-full text-center gap-4'>
            <div className='w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center'>
              <BookOpen size={28} className='text-gray-400' />
            </div>
            <div>
              <p className='text-gray-600 font-medium'>
                {!hasSession
                  ? 'Select or create a notebook to get started'
                  : !hasDocuments
                    ? 'Add sources to start chatting'
                    : 'Ask anything about your sources'}
              </p>
              <p className='text-sm text-gray-400 mt-1'>
                {canSend &&
                  'The AI will answer based on your uploaded documents'}
              </p>
            </div>
          </div>
        )}

        <div className='space-y-4 mb-4'>
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onCitationClick={onCitationClick}
              onChipSend={(q) => handleSend(q)}
              chipsDisabled={!canSend || streaming}
            />
          ))}
        </div>

        {streaming && <StreamingBubble content={streamingContent} />}
        <div ref={bottomRef} />
      </div>

      <div className='px-6 py-4 border-t border-gray-100'>
        {!canSend && (
          <p className='text-xs text-gray-400 mb-2 text-center'>
            {!hasSession
              ? 'Create a notebook first'
              : 'Upload at least one source to chat'}
          </p>
        )}
        <div
          className={`flex gap-3 items-end rounded-2xl border transition-colors ${
            canSend
              ? 'border-gray-200 focus-within:border-blue-400'
              : 'border-gray-100 bg-gray-50'
          } p-3`}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={!canSend || streaming}
            placeholder={canSend ? 'Ask a question about your sources...' : ''}
            rows={1}
            className='flex-1 resize-none text-lg outline-none bg-transparent text-gray-800 placeholder-gray-400 disabled:cursor-not-allowed'
            style={{ maxHeight: '160px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!canSend || !input.trim() || streaming}
            className='flex-shrink-0 w-7 h-7 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors'
          >
            {streaming ? (
              <Loader2 size={14} className='animate-spin text-white' />
            ) : (
              <Send size={14} className='text-white' />
            )}
          </button>
        </div>
        <p className='text-xs text-gray-300 mt-2 text-center'>
          Press Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
