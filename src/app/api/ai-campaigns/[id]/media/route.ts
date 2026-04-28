import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

function mediaBucketName(): string {
  return (process.env.AI_NURTURE_MEDIA_BUCKET || 'ai-nurture-media').trim();
}

const SUPPORTED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

function uploadErrorResponse(message: string) {
  const isBucket =
    /bucket not found|no such|does not exist|not exist/i.test(message) ||
    message === 'The resource was not found';
  return Response.json(
    {
      error: isBucket
        ? `Storage bucket "${mediaBucketName()}" does not exist. In Supabase → SQL, run the SQL in supabase/migration_storage_ai_nurture_media.sql (or create a public bucket with that name). Or set AI_NURTURE_MEDIA_BUCKET to an existing public bucket (e.g. property-images) in Vercel env.`
        : message,
    },
    { status: isBucket ? 503 : 500 }
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getServiceClient();
  const { data } = await db
    .from('drip_ai_media')
    .select('*')
    .eq('campaign_id', id)
    .order('sort_order');

  return Response.json({ media: data || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getServiceClient();
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const bucket = mediaBucketName();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string) || 'Banner';
    const sendWith = (formData.get('send_with') as string) || 'any';

    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

    const mime = file.type.toLowerCase();
    if (!SUPPORTED_MIME.includes(mime)) {
      return Response.json(
        { error: `Unsupported file type: ${mime}. Use JPEG, PNG, or GIF.` },
        { status: 400 }
      );
    }

    const ext = mime.includes('png') ? 'png' : mime.includes('gif') ? 'gif' : 'jpg';
    const path = `${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await db.storage
      .from(bucket)
      .upload(path, arrayBuffer, { contentType: mime, upsert: false });

    if (uploadError) return uploadErrorResponse(uploadError.message);

    const { data: urlData } = db.storage.from(bucket).getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const { data, error } = await db
      .from('drip_ai_media')
      .insert({
        campaign_id: id,
        title,
        media_url: publicUrl,
        mime_type: mime,
        send_with: sendWith,
        sort_order: 0,
      })
      .select('*')
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ media: data }, { status: 201 });
  }

  // URL-based (existing behaviour)
  const body = await request.json();
  const { data, error } = await db
    .from('drip_ai_media')
    .insert({
      campaign_id: id,
      title: body.title || 'Untitled',
      media_url: body.media_url,
      mime_type: body.mime_type || null,
      send_with: body.send_with || 'any',
      sort_order: body.sort_order ?? 0,
    })
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ media: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { media_id } = await request.json();
  if (!media_id) return Response.json({ error: 'media_id required' }, { status: 400 });

  const db = getServiceClient();
  await db.from('drip_ai_media').delete().eq('id', media_id);

  return Response.json({ success: true });
}
