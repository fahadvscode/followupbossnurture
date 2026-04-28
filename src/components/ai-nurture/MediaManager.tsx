'use client';

import { useState, useCallback, useRef } from 'react';
import { Image as ImageIcon, Plus, Trash2, Upload, Link } from 'lucide-react';
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

type AddMode = 'file' | 'url';

export function MediaManager({ campaignId, media, onUpdate }: Props) {
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('file');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [sendWith, setSendWith] = useState<AiMediaSendWith>('any');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle('');
    setUrl('');
    setPreview(null);
    setSelectedFile(null);
    setError('');
    setAdding(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const supported = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!supported.includes(file.type.toLowerCase())) {
      setError('Only JPEG, PNG, and GIF are supported for MMS.');
      return;
    }
    setError('');
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const saveFile = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true);
    setError('');
    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('title', title || 'Banner');
    fd.append('send_with', sendWith);

    const res = await fetch(`/api/ai-campaigns/${campaignId}/media`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Upload failed');
      setSaving(false);
      return;
    }
    reset();
    setSaving(false);
    onUpdate();
  }, [campaignId, selectedFile, title, sendWith, onUpdate]);

  const saveUrl = useCallback(async () => {
    if (!url.trim()) return;
    setSaving(true);
    setError('');

    const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif' };
    const mime = mimeMap[ext || ''] || 'image/jpeg';
    const supported = ['image/jpeg', 'image/png', 'image/gif'];
    if (!supported.includes(mime)) {
      setError('Only JPEG, PNG, and GIF URLs are supported. Twilio rejects webp/svg.');
      setSaving(false);
      return;
    }

    const res = await fetch(`/api/ai-campaigns/${campaignId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title || 'Banner', media_url: url, send_with: sendWith, mime_type: mime }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Save failed');
      setSaving(false);
      return;
    }
    reset();
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
          onClick={() => { setAdding(true); setAddMode('file'); }}
          className="flex items-center gap-1 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {adding && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setAddMode('file'); setError(''); }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                addMode === 'file'
                  ? 'bg-accent text-white'
                  : 'border border-border text-muted hover:text-foreground'
              }`}
            >
              <Upload size={12} /> Upload File
            </button>
            <button
              type="button"
              onClick={() => { setAddMode('url'); setError(''); }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                addMode === 'url'
                  ? 'bg-accent text-white'
                  : 'border border-border text-muted hover:text-foreground'
              }`}
            >
              <Link size={12} /> Paste URL
            </button>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Novella Flyer)"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />

          {addMode === 'file' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif"
                onChange={handleFileChange}
                className="w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent hover:file:bg-accent/20"
              />
              <p className="text-xs text-muted mt-1">JPEG, PNG, or GIF only (Twilio MMS requirement)</p>
              {preview && (
                <div className="mt-2 rounded-md overflow-hidden border border-border w-32 h-20 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          ) : (
            <div>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://... (must be JPEG, PNG, or GIF)"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              />
              <p className="text-xs text-muted mt-1">Twilio does not support webp or svg for MMS</p>
            </div>
          )}

          <select
            value={sendWith}
            onChange={(e) => setSendWith(e.target.value as AiMediaSendWith)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            {(Object.entries(sendWithLabels) as [AiMediaSendWith, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={addMode === 'file' ? saveFile : saveUrl}
              disabled={saving || (addMode === 'file' ? !selectedFile : !url.trim())}
              className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? 'Uploading...' : 'Save'}
            </button>
            <button
              onClick={reset}
              className="rounded-lg border border-border px-4 py-1.5 text-xs font-medium text-muted hover:bg-card-hover"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {media.length === 0 && !adding && (
        <p className="text-xs text-muted py-4 text-center">
          No media yet. Upload banners or flyers to send as MMS images.
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
                <p className="text-xs text-muted">
                  {sendWithLabels[m.send_with]}
                  {m.mime_type && ` · ${m.mime_type}`}
                  {!['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes((m.mime_type || '').toLowerCase()) && (
                    <span className="text-yellow-600 ml-1">⚠ unsupported format</span>
                  )}
                </p>
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
