'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Folder,
  FolderInput,
  FolderPlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import type { DripMessageTemplate, DripTemplateFolder } from '@/types';

type ChannelFilter = 'all' | 'sms' | 'email';
type FolderScope = 'all' | 'unfiled' | string;

export default function TemplatesClient() {
  const [folders, setFolders] = useState<DripTemplateFolder[]>([]);
  const [list, setList] = useState<DripMessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [filter, setFilter] = useState<ChannelFilter>('all');
  const [folderScope, setFolderScope] = useState<FolderScope>('all');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderActionError, setFolderActionError] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderDraft, setRenameFolderDraft] = useState('');
  const [quickFolderName, setQuickFolderName] = useState('');
  const [quickFolderSaving, setQuickFolderSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formChannel, setFormChannel] = useState<'sms' | 'email'>('sms');
  const [formSubject, setFormSubject] = useState('');
  const [formPlain, setFormPlain] = useState('');
  const [formHtml, setFormHtml] = useState('');
  const [formFolderId, setFormFolderId] = useState<string>('');

  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    setFolderActionError(null);
    try {
      const r = await fetch('/api/template-folders', { credentials: 'same-origin' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFolders([]);
        setFolderActionError(
          typeof d.error === 'string' ? d.error : 'Could not load folders (check DB migration).'
        );
        return;
      }
      setFolders(Array.isArray(d.folders) ? d.folders : []);
    } catch {
      setFolders([]);
      setFolderActionError('Network error loading folders.');
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('channel', filter);
      if (folderScope === 'unfiled') params.set('folder_id', 'unfiled');
      else if (folderScope !== 'all') params.set('folder_id', folderScope);
      const q = params.toString();
      const r = await fetch(`/api/templates${q ? `?${q}` : ''}`);
      const d = await r.json();
      setList(d.templates || []);
    } finally {
      setLoading(false);
    }
  }, [filter, folderScope]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  function folderLabel(id: string | null): string {
    if (!id) return '';
    const f = folders.find((x) => x.id === id);
    return f?.name || '';
  }

  function resetForm() {
    setEditingId(null);
    setFormName('');
    setFormChannel('sms');
    setFormSubject('');
    setFormPlain('');
    setFormHtml('');
    setFormFolderId(
      folderScope !== 'all' && folderScope !== 'unfiled' ? folderScope : ''
    );
  }

  function startCreate() {
    resetForm();
    setEditingId('__new__');
    setFormFolderId(
      folderScope !== 'all' && folderScope !== 'unfiled' ? folderScope : ''
    );
  }

  function startEdit(t: DripMessageTemplate) {
    setEditingId(t.id);
    setFormName(t.name);
    setFormChannel(t.channel);
    setFormSubject(t.email_subject || '');
    setFormPlain(t.body_plain || '');
    setFormHtml(t.body_html || '');
    setFormFolderId(t.folder_id || '');
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const folder_id =
        formFolderId.trim() === '' ? null : formFolderId.trim();
      if (editingId === '__new__') {
        const r = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            channel: formChannel,
            email_subject: formChannel === 'email' ? formSubject.trim() : '',
            body_plain: formPlain,
            body_html: formChannel === 'email' && formHtml.trim() ? formHtml : null,
            folder_id,
          }),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          alert(err.error || 'Save failed');
          return;
        }
        resetForm();
      } else if (editingId) {
        const r = await fetch(`/api/templates/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            email_subject: formSubject.trim(),
            body_plain: formPlain,
            body_html: formHtml.trim() ? formHtml : null,
            folder_id,
          }),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          alert(err.error || 'Update failed');
          return;
        }
        resetForm();
      }
      await loadTemplates();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    if (editingId === id) resetForm();
    await loadTemplates();
  }

  async function postNewFolder(name: string): Promise<{ id: string } | null> {
    const r = await fetch('/api/template-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      credentials: 'same-origin',
    });
    const payload = await r.json().catch(() => ({}));
    if (!r.ok) {
      setFolderActionError(
        typeof payload.error === 'string'
          ? payload.error
          : 'Could not create folder (is drip_template_folders in your database?)'
      );
      return null;
    }
    const id = (payload as { id?: string }).id;
    return id ? { id } : null;
  }

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) {
      setFolderActionError('Type a folder name in the box, then click Create folder.');
      return;
    }
    setFolderActionError(null);
    setCreatingFolder(true);
    try {
      const created = await postNewFolder(name);
      if (!created) return;
      setNewFolderName('');
      await loadFolders();
      setFolderScope(created.id);
    } catch {
      setFolderActionError('Network error — could not create folder.');
    } finally {
      setCreatingFolder(false);
    }
  }

  async function createFolderFromEditor() {
    const name = quickFolderName.trim();
    if (!name) {
      setFolderActionError('Type a name for the new folder.');
      return;
    }
    setFolderActionError(null);
    setQuickFolderSaving(true);
    try {
      const created = await postNewFolder(name);
      if (!created) return;
      setQuickFolderName('');
      await loadFolders();
      setFormFolderId(created.id);
      setFolderScope(created.id);
    } catch {
      setFolderActionError('Network error — could not create folder.');
    } finally {
      setQuickFolderSaving(false);
    }
  }

  function startRenameFolder(f: DripTemplateFolder) {
    setRenamingFolderId(f.id);
    setRenameFolderDraft(f.name);
    setFolderActionError(null);
  }

  function cancelRenameFolder() {
    setRenamingFolderId(null);
    setRenameFolderDraft('');
  }

  async function saveRenameFolder() {
    const id = renamingFolderId;
    const name = renameFolderDraft.trim();
    if (!id || !name) {
      setFolderActionError('Folder name cannot be empty.');
      return;
    }
    setFolderActionError(null);
    try {
      const r = await fetch(`/api/template-folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
        credentials: 'same-origin',
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFolderActionError(
          typeof payload.error === 'string' ? payload.error : 'Could not rename folder.'
        );
        return;
      }
      cancelRenameFolder();
      await loadFolders();
    } catch {
      setFolderActionError('Network error — could not rename folder.');
    }
  }

  async function handleDeleteFolder(id: string, name: string) {
    if (!confirm(`Delete folder "${name}"? Templates inside become unfiled.`)) return;
    const r = await fetch(`/api/template-folders/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      alert(err.error || 'Delete failed');
      return;
    }
    if (folderScope === id) setFolderScope('all');
    await loadFolders();
    await loadTemplates();
  }

  function onHtmlFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setFormHtml(text);
      if (formChannel === 'email' && !formPlain.trim()) {
        setFormPlain(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const showEditor = editingId !== null;
  const filteredList =
    filter === 'all' ? list : list.filter((t) => t.channel === filter);

  const scopeTitle =
    folderScope === 'all'
      ? 'All folders'
      : folderScope === 'unfiled'
        ? 'Unfiled'
        : folderLabel(folderScope) || 'Folder';

  return (
    <div>
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-6"
      >
        <ArrowLeft size={14} /> Back to Campaigns
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Message templates</h1>
          <p className="text-sm text-muted mt-1 max-w-xl">
            Organize SMS and email templates in folders, then pick them from each campaign touch. Merge
            tags: {'{first_name}'}, {'{project}'}, etc. HTML emails need absolute image URLs.
          </p>
        </div>
        <Button type="button" onClick={startCreate} variant="secondary">
          <Plus size={14} className="mr-2" /> New template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,1fr)] gap-4 lg:gap-6">
        <Card className="lg:min-h-[28rem]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Folders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground" htmlFor="new-folder-name">
                Folder name
              </label>
              <Input
                id="new-folder-name"
                value={newFolderName}
                onChange={(e) => {
                  setNewFolderName(e.target.value);
                  if (folderActionError) setFolderActionError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void createFolder();
                  }
                }}
                placeholder="e.g. ISA drips, Onboarding"
                className="text-sm"
                autoComplete="off"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={creatingFolder}
                onClick={() => void createFolder()}
              >
                <FolderPlus size={14} className="mr-1.5" />
                {creatingFolder ? 'Creating…' : 'Create folder'}
              </Button>
              <p className="text-[11px] text-muted leading-snug">
                Enter the name above, then <strong>Create folder</strong> or press Enter. Use the pencil on
                a folder to rename it.
              </p>
              {folderActionError ? (
                <p className="text-xs text-danger" role="alert">
                  {folderActionError}
                </p>
              ) : null}
            </div>
            <nav className="flex flex-col gap-0.5 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setFolderScope('all')}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  folderScope === 'all'
                    ? 'bg-accent/15 text-accent font-medium'
                    : 'text-muted hover:bg-card-hover hover:text-foreground'
                )}
              >
                <Folder size={14} />
                All templates
              </button>
              <button
                type="button"
                onClick={() => setFolderScope('unfiled')}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  folderScope === 'unfiled'
                    ? 'bg-accent/15 text-accent font-medium'
                    : 'text-muted hover:bg-card-hover hover:text-foreground'
                )}
              >
                <FolderInput size={14} />
                Unfiled
              </button>
              {foldersLoading ? (
                <p className="text-xs text-muted px-2 py-1 flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" /> Loading…
                </p>
              ) : (
                folders.map((f) =>
                  renamingFolderId === f.id ? (
                    <div key={f.id} className="rounded-md border border-border bg-card-hover p-2 space-y-2">
                      <label className="text-[10px] uppercase tracking-wide text-muted">Folder name</label>
                      <Input
                        value={renameFolderDraft}
                        onChange={(e) => setRenameFolderDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void saveRenameFolder();
                          }
                          if (e.key === 'Escape') cancelRenameFolder();
                        }}
                        className="text-sm"
                        autoFocus
                        autoComplete="off"
                      />
                      <div className="flex gap-1">
                        <Button type="button" size="sm" className="flex-1" onClick={() => void saveRenameFolder()}>
                          Save name
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={cancelRenameFolder}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={f.id}
                      className={cn(
                        'group flex items-center gap-0.5 rounded-md pr-1',
                        folderScope === f.id ? 'bg-accent/15' : ''
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setFolderScope(f.id)}
                        className={cn(
                          'flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors min-w-0',
                          folderScope === f.id
                            ? 'text-accent font-medium'
                            : 'text-muted hover:bg-card-hover hover:text-foreground'
                        )}
                      >
                        <Folder size={14} className="shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-60 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          startRenameFolder(f);
                        }}
                        aria-label={`Rename folder ${f.name}`}
                      >
                        <Pencil size={12} className="text-muted" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-60 group-hover:opacity-100"
                        onClick={() => handleDeleteFolder(f.id, f.name)}
                        aria-label={`Delete folder ${f.name}`}
                      >
                        <Trash2 size={12} className="text-danger" />
                      </Button>
                    </div>
                  )
                )
              )}
            </nav>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              <span className="text-muted font-normal text-sm block">Library</span>
              {scopeTitle}
            </CardTitle>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as ChannelFilter)}
              className="w-36"
            >
              <option value="all">All types</option>
              <option value="sms">SMS only</option>
              <option value="email">Email only</option>
            </Select>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </p>
            ) : filteredList.length === 0 ? (
              <p className="text-sm text-muted">
                No templates in this view. Use <strong>New template</strong> or pick another folder.
              </p>
            ) : (
              <ul className="space-y-2 max-h-[min(60vh,32rem)] overflow-y-auto pr-1">
                {filteredList.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card-hover px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                      <p className="text-xs text-muted">
                        {t.channel === 'sms' ? 'SMS' : 'Email'}
                        {t.channel === 'email' && t.body_html?.trim() ? ' · HTML' : ''}
                        {folderScope === 'all' && t.folder_id ? (
                          <span className="text-muted/80"> · {folderLabel(t.folder_id)}</span>
                        ) : null}
                        {t.channel === 'email' && t.email_subject
                          ? ` · ${
                              t.email_subject.length > 28
                                ? `${t.email_subject.slice(0, 28)}…`
                                : t.email_subject
                            }`
                          : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(t)}
                        aria-label="Edit"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(t.id)}
                        aria-label="Delete"
                      >
                        <Trash2 size={14} className="text-danger" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId === '__new__' ? 'New template' : editingId ? 'Edit template' : 'Editor'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showEditor ? (
              <p className="text-sm text-muted">
                Choose <strong>New template</strong> or edit a template from the list.
              </p>
            ) : (
              <>
                <div className="space-y-3 rounded-lg border border-border bg-card-hover/50 p-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Folder for this template</label>
                    <Select
                      value={formFolderId}
                      onChange={(e) => setFormFolderId(e.target.value)}
                    >
                      <option value="">Unfiled</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1" htmlFor="quick-folder-name">
                      Or create a folder by name
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        id="quick-folder-name"
                        value={quickFolderName}
                        onChange={(e) => {
                          setQuickFolderName(e.target.value);
                          if (folderActionError) setFolderActionError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void createFolderFromEditor();
                          }
                        }}
                        placeholder="Type new folder name…"
                        className="text-sm flex-1"
                        autoComplete="off"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="shrink-0"
                        disabled={quickFolderSaving}
                        onClick={() => void createFolderFromEditor()}
                      >
                        {quickFolderSaving ? 'Creating…' : 'Create & use'}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted mt-1">
                      Creates the folder and selects it for this template.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Name</label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. ISA — Day 1 intro SMS"
                  />
                </div>
                {editingId === '__new__' && (
                  <div>
                    <label className="block text-xs text-muted mb-1">Channel</label>
                    <Select
                      value={formChannel}
                      onChange={(e) => setFormChannel(e.target.value as 'sms' | 'email')}
                    >
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                    </Select>
                  </div>
                )}
                {formChannel === 'email' && (
                  <div>
                    <label className="block text-xs text-muted mb-1">Subject line</label>
                    <Input
                      value={formSubject}
                      onChange={(e) => setFormSubject(e.target.value)}
                      placeholder="{first_name}, your update on {project}"
                    />
                  </div>
                )}
                {formChannel === 'sms' ? (
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      SMS body{' '}
                      <span className="text-muted/70">
                        {'{first_name}'} {'{project}'} …
                      </span>
                    </label>
                    <Textarea
                      value={formPlain}
                      onChange={(e) => setFormPlain(e.target.value)}
                      rows={6}
                      placeholder="Hi {first_name}, …"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-muted mb-1">
                        Plain-text version (optional but recommended for inbox previews &amp; SMTP text
                        part)
                      </label>
                      <Textarea
                        value={formPlain}
                        onChange={(e) => setFormPlain(e.target.value)}
                        rows={4}
                        placeholder="Short plain summary…"
                      />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <label className="block text-xs text-muted">
                          HTML body (paste from your builder or load a .html file)
                        </label>
                        <label className="inline-flex items-center gap-1 text-xs text-accent cursor-pointer hover:underline">
                          <Upload size={12} />
                          Upload .html
                          <input type="file" accept=".html,.htm,text/html" className="hidden" onChange={onHtmlFile} />
                        </label>
                      </div>
                      <Textarea
                        value={formHtml}
                        onChange={(e) => setFormHtml(e.target.value)}
                        rows={12}
                        className="font-mono text-xs"
                        placeholder="<!DOCTYPE html><html>…</html>"
                      />
                      <p className="text-xs text-muted mt-1">
                        Merge tags in HTML work the same: {'{first_name}'}, {'{project}'}, etc.
                      </p>
                    </div>
                    {formHtml.trim() && (
                      <div className="rounded-lg border border-border overflow-hidden bg-background">
                        <p className="text-[10px] uppercase tracking-wide text-muted px-3 py-1.5 bg-card-hover border-b border-border">
                          Preview
                        </p>
                        <iframe title="Template preview" className="w-full min-h-[220px] bg-white" srcDoc={formHtml} />
                      </div>
                    )}
                  </>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : editingId === '__new__' ? 'Create' : 'Save changes'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
