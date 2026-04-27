'use client';

import { useState, useCallback } from 'react';
import { Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import type { AiMedia, AiMediaSendWith } from '@/types';

interface Props {
  campaignId: string;
  media: AiMedia[];
  onUpdate: () => void;
}

const sendWithLabels: Record<AiMediaSendWith, string> = {
  first: 'First message',
  follow_up: 'Follow-ups',
  any: 'Any message',
  manual: 'Manual only',
};

export function MediaManager({ campaignId, media, onUpdate }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [sendWith, setSendWith] = useState<AiMediaSendWith>('any');
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (!url.trim()) return;
    setSaving(true);
    await fetch(`/api/ai-campaigns/${campaignId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title || 'Banner',
        media_url: url,
        send_with: sendWith,
        mime_type: 'image/jpeg',
      }),
    });
    setTitle('');
    setUrl('');
    setAdding(false);
    setSaving(false);
    onUpdate();
  }, [campaignId, title, url, sendWith, onUpdate]);

  const deleteMedia = useCallback(
    async (mediaId: string) => {
      await fetch(`/api/ai-campaigns/${campaignId}/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: mediaId }),
      });
      onUpdate();
    },
    [campaignId, onUpdate]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">MMS Media (Banners/Flyers)</h3>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {adding && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Novella Flyer)"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Public image URL (https://...)"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
          <select
            value={sendWith}
            onChange={(e) => setSendWith(e.target.value as AiMediaSendWith)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            {(Object.entries(sendWithLabels) as [AiMediaSendWith, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !url.trim()}
              className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-lg border border-border px-4 py-1.5 text-xs font-medium text-muted hover:bg-card-hover"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {media.length === 0 && !adding && (
        <p className="text-xs text-muted py-4 text-center">
          No media yet. Add banners or flyers to send as MMS images.
        </p>
      )}

      <div className="space-y-2">
        {media.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <ImageIcon size={16} className="text-muted shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                <p className="text-xs text-muted">{sendWithLabels[m.send_with]}</p>
              </div>
            </div>
            <button
              onClick={() => deleteMedia(m.id)}
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
