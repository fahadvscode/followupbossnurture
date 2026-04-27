'use client';

import { useState, useCallback } from 'react';
import { FileText, Plus, Trash2, Upload } from 'lucide-react';
import type { AiKnowledgeDoc } from '@/types';

interface Props {
  campaignId: string;
  docs: AiKnowledgeDoc[];
  onUpdate: () => void;
}

export function KnowledgeManager({ campaignId, docs, onUpdate }: Props) {
  const [adding, setAdding] = useState<'text' | 'file' | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const saveText = useCallback(async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    await fetch(`/api/ai-campaigns/${campaignId}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_type: 'text', title, content_text: content }),
    });
    setTitle('');
    setContent('');
    setAdding(null);
    setSaving(false);
    onUpdate();
  }, [campaignId, title, content, onUpdate]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setSaving(true);

      const text = await file.text();
      await fetch(`/api/ai-campaigns/${campaignId}/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: 'file',
          title: file.name,
          content_text: '',
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          extracted_text: text.slice(0, 50000),
        }),
      });
      setSaving(false);
      onUpdate();
    },
    [campaignId, onUpdate]
  );

  const deleteDoc = useCallback(
    async (docId: string) => {
      await fetch(`/api/ai-campaigns/${campaignId}/knowledge`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_id: docId }),
      });
      onUpdate();
    },
    [campaignId, onUpdate]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Knowledge Base</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAdding('text')}
            className="flex items-center gap-1 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20"
          >
            <Plus size={14} /> Text
          </button>
          <label className="flex cursor-pointer items-center gap-1 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20">
            <Upload size={14} /> File
            <input
              type="file"
              accept=".txt,.md,.csv,.pdf,.doc,.docx"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>

      {adding === 'text' && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste project info, pricing, location details, selling points..."
            rows={6}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={saveText}
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setAdding(null)}
              className="rounded-lg border border-border px-4 py-1.5 text-xs font-medium text-muted hover:bg-card-hover"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {docs.length === 0 && !adding && (
        <p className="text-xs text-muted py-4 text-center">
          No documents yet. Add project info so the AI knows what to talk about.
        </p>
      )}

      <div className="space-y-2">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="flex items-start justify-between rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-start gap-2 min-w-0">
              <FileText size={16} className="mt-0.5 text-muted shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                <p className="text-xs text-muted">
                  {doc.doc_type === 'file' ? doc.file_name : `${(doc.content_text || '').length} chars`}
                </p>
              </div>
            </div>
            <button
              onClick={() => deleteDoc(doc.id)}
              className="text-muted hover:text-red-500 shrink-0 ml-2"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
