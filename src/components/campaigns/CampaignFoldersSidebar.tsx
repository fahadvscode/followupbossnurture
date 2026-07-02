'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { useCampaignFolders } from '@/hooks/useCampaignFolders';
import { Folder, FolderInput, FolderPlus, Loader2, Pencil, Trash2 } from 'lucide-react';

type FolderState = ReturnType<typeof useCampaignFolders>;

type Props = {
  folders: FolderState;
  onDeleteFolder?: (folderId: string) => void;
};

export function CampaignFoldersSidebar({ folders: f, onDeleteFolder }: Props) {
  return (
    <Card className="lg:min-h-[20rem] h-fit">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Folders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-foreground" htmlFor="new-campaign-folder">
            Folder name
          </label>
          <Input
            id="new-campaign-folder"
            value={f.newFolderName}
            onChange={(e) => {
              f.setNewFolderName(e.target.value);
              if (f.folderActionError) f.setFolderActionError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void f.createFolder();
              }
            }}
            placeholder="e.g. Pre-Con, ISA"
            className="text-sm"
            autoComplete="off"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={f.creatingFolder}
            onClick={() => void f.createFolder()}
          >
            <FolderPlus size={14} className="mr-1.5" />
            {f.creatingFolder ? 'Creating…' : 'Create folder'}
          </Button>
          {f.folderActionError ? (
            <p className="text-xs text-danger" role="alert">
              {f.folderActionError}
            </p>
          ) : null}
        </div>

        <nav className="flex flex-col gap-0.5 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => f.setFolderScope('all')}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
              f.folderScope === 'all'
                ? 'bg-accent/15 text-accent font-medium'
                : 'text-muted hover:bg-card-hover hover:text-foreground'
            )}
          >
            <Folder size={14} />
            All campaigns
          </button>
          <button
            type="button"
            onClick={() => f.setFolderScope('unfiled')}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
              f.folderScope === 'unfiled'
                ? 'bg-accent/15 text-accent font-medium'
                : 'text-muted hover:bg-card-hover hover:text-foreground'
            )}
          >
            <FolderInput size={14} />
            Unfiled
          </button>
          {f.foldersLoading ? (
            <p className="text-xs text-muted px-2 py-1 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Loading…
            </p>
          ) : (
            f.folders.map((folder) =>
              f.renamingFolderId === folder.id ? (
                <div key={folder.id} className="rounded-md border border-border bg-card-hover p-2 space-y-2">
                  <Input
                    value={f.renameFolderDraft}
                    onChange={(e) => f.setRenameFolderDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void f.saveRenameFolder();
                      }
                      if (e.key === 'Escape') f.cancelRenameFolder();
                    }}
                    className="text-sm"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button type="button" size="sm" onClick={() => void f.saveRenameFolder()}>
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={f.cancelRenameFolder}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div key={folder.id} className="group flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => f.setFolderScope(folder.id)}
                    className={cn(
                      'flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors min-w-0',
                      f.folderScope === folder.id
                        ? 'bg-accent/15 text-accent font-medium'
                        : 'text-muted hover:bg-card-hover hover:text-foreground'
                    )}
                  >
                    <Folder size={14} className="shrink-0" />
                    <span className="truncate">{folder.name}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Rename ${folder.name}`}
                    onClick={() => f.startRenameFolder(folder)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-foreground rounded"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${folder.name}`}
                    onClick={() => void f.deleteFolder(folder.id, folder.name, onDeleteFolder)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-danger rounded"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            )
          )}
        </nav>
      </CardContent>
    </Card>
  );
}
