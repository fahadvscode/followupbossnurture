import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

function copyFolderName(name: string): string {
  const t = name.trim();
  return t.endsWith(' (copy)') ? `${t} 2` : `${t} (copy)`;
}

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const db = getServiceClient();

  const { data: folder, error: fErr } = await db
    .from('drip_template_folders')
    .select('*')
    .eq('id', id)
    .single();

  if (fErr || !folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  const { data: newFolder, error: insFErr } = await db
    .from('drip_template_folders')
    .insert({
      name: copyFolderName(folder.name),
      sort_order: folder.sort_order ?? 0,
    })
    .select()
    .single();

  if (insFErr || !newFolder) {
    return NextResponse.json({ error: insFErr?.message || 'Failed to create folder' }, { status: 500 });
  }

  const { data: templates } = await db.from('drip_message_templates').select('*').eq('folder_id', id);

  let copied = 0;
  for (const t of templates || []) {
    const nm = t.name.trim().endsWith(' (copy)') ? `${t.name.trim()} 2` : `${t.name.trim()} (copy)`;
    const { error: tErr } = await db.from('drip_message_templates').insert({
      name: nm,
      channel: t.channel,
      email_subject: t.email_subject ?? '',
      body_plain: t.body_plain ?? '',
      body_html: t.body_html,
      folder_id: newFolder.id,
    });
    if (!tErr) copied += 1;
  }

  return NextResponse.json({ folder: newFolder, templatesCopied: copied });
}
