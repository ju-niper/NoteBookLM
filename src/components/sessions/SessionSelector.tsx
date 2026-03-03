import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  BookOpen,
} from 'lucide-react';

import type { Session } from '../../types';

interface Props {
  sessions: Session[];
  activeSession: Session | null;
  onSelect: (session: Session) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export default function SessionSelector({
  sessions,
  activeSession,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCreate = () => {
    const name = newName.trim() || 'Untitled Notebook';
    onCreate(name);
    setNewName('');
    setCreating(false);
    setOpen(false);
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      onRename(id, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div ref={ref} className='relative'>
      <button
        onClick={() => setOpen((o) => !o)}
        className='flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-white'
      >
        <BookOpen size={16} />
        <span className='max-w-[200px] truncate text-sm font-medium'>
          {activeSession?.name ?? 'Select notebook'}
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className='absolute top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden'>
          <div className='p-2'>
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer group ${
                  activeSession?.id === s.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                {editingId === s.id ? (
                  <div
                    className='flex flex-1 items-center gap-1'
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(s.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className='flex-1 text-sm border rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-400'
                    />
                    <button
                      onClick={() => handleRename(s.id)}
                      className='text-green-600 hover:text-green-700'
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className='text-gray-400 hover:text-gray-600'
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span
                      className={`flex-1 text-sm truncate ${activeSession?.id === s.id ? 'text-blue-700 font-medium' : 'text-gray-700'}`}
                      onClick={() => {
                        onSelect(s);
                        setOpen(false);
                      }}
                    >
                      {s.name}
                    </span>
                    <div className='flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(s.id);
                          setEditName(s.name);
                        }}
                        className='text-gray-400 hover:text-gray-600 p-0.5 rounded'
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(s.id);
                        }}
                        className='text-gray-400 hover:text-red-500 p-0.5 rounded'
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className='border-t border-gray-100 p-2'>
            {creating ? (
              <div className='flex items-center gap-2 px-2'>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') setCreating(false);
                  }}
                  placeholder='Notebook name...'
                  className='flex-1 text-sm border rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-blue-400'
                />
                <button
                  onClick={handleCreate}
                  className='text-blue-600 hover:text-blue-700'
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className='text-gray-400 hover:text-gray-600'
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className='flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors'
              >
                <Plus size={14} />
                New notebook
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
