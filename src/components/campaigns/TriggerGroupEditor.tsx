'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { TriggerGroup } from '@/types';

type GroupDraft = { label: string; tagsText: string };

type Props = {
  value: TriggerGroup[];
  minGroups: number;
  onChange: (groups: TriggerGroup[], minGroups: number) => void;
};

function parseTags(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );
}

function draftsToGroups(rows: GroupDraft[]): TriggerGroup[] {
  return rows
    .map((r) => ({ label: r.label.trim(), tags: parseTags(r.tagsText) }))
    .filter((g) => g.tags.length > 0);
}

export function TriggerGroupEditor({ value, minGroups, onChange }: Props) {
  const [rows, setRows] = useState<GroupDraft[]>(() =>
    value.length > 0
      ? value.map((g) => ({ label: g.label || '', tagsText: (g.tags || []).join(', ') }))
      : [
          { label: 'Property Type', tagsText: '' },
          { label: 'City', tagsText: '' },
          { label: 'Category', tagsText: '' },
        ]
  );

  function emit(nextRows: GroupDraft[], nextMin: number) {
    const groups = draftsToGroups(nextRows);
    const clampedMin = groups.length > 0 ? Math.min(Math.max(1, nextMin), groups.length) : 1;
    onChange(groups, clampedMin);
  }

  function updateRow(index: number, patch: Partial<GroupDraft>) {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    setRows(next);
    emit(next, minGroups);
  }

  function addRow() {
    const next = [...rows, { label: '', tagsText: '' }];
    setRows(next);
    emit(next, minGroups);
  }

  function removeRow(index: number) {
    const next = rows.filter((_, i) => i !== index);
    setRows(next);
    emit(next, minGroups);
  }

  const filledGroupCount = draftsToGroups(rows).length;
  const minOptions = Math.max(1, filledGroupCount);

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={row.label}
                onChange={(e) => updateRow(i, { label: e.target.value })}
                placeholder="Group name (e.g. City)"
                className="text-sm"
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="text-muted hover:text-danger shrink-0 p-1"
                  aria-label="Remove group"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <Input
              value={row.tagsText}
              onChange={(e) => updateRow(i, { tagsText: e.target.value })}
              placeholder="Tags in this group, comma separated (e.g. Detached, Townhome)"
            />
          </div>
        ))}
      </div>

      <Button type="button" variant="secondary" size="sm" onClick={addRow}>
        <Plus size={14} className="mr-1" /> Add group
      </Button>

      <div className="flex items-center gap-2 pt-1">
        <span className="text-sm text-foreground">Match at least</span>
        <select
          value={Math.min(minGroups, minOptions)}
          onChange={(e) => emit(rows, Number(e.target.value))}
          className="bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          {Array.from({ length: minOptions }, (_, n) => n + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="text-sm text-foreground">
          of {filledGroupCount || rows.length} group{(filledGroupCount || rows.length) === 1 ? '' : 's'} to enroll
        </span>
      </div>
      <p className="text-xs text-muted">
        A lead enrolls only when its tags exactly match a tag in at least this many groups. Tags within the same
        group count once (e.g. matching both Detached and Townhome still counts as one group).
      </p>
    </div>
  );
}
