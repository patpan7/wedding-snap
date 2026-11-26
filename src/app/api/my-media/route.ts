import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/clients';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const guestId = searchParams.get('guestId');

  if (!slug || !guestId) {
    return NextResponse.json({ error: 'Missing slug or guestId' }, { status: 400 });
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .select('id')
    .eq('slug', slug)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const { data: media, error: mediaError } = await supabaseAdmin
    .from('media')
    .select('id, public_url, mime_type, is_approved')
    .eq('event_id', event.id)
    .eq('guest_id', guestId)
    .order('created_at', { ascending: false });

  if (mediaError) throw mediaError;

  return NextResponse.json({ media: media || [] });
}

export async function DELETE(req: Request) {
  try {
    const { slug, guestId, mediaIds } = await req.json();

    if (!slug || !guestId || !mediaIds?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('slug', slug)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Verify ownership and delete
    const { data: media, error: fetchError } = await supabaseAdmin
      .from('media')
      .select('id, file_key')
      .eq('event_id', event.id)
      .eq('guest_id', guestId)
      .in('id', mediaIds);

    if (fetchError) throw fetchError;

    if (!media?.length) {
      return NextResponse.json({ error: 'No matching media found' }, { status: 404 });
    }

    // Delete from DB
    const { error: deleteError } = await supabaseAdmin
      .from('media')
      .delete()
      .in('id', media.map((m) => m.id));

    if (deleteError) throw deleteError;

    // Note: R2 deletion would require r2Client - skipping for now
    // For full cleanup, you'd also delete from R2 using the file_keys

    return NextResponse.json({ success: true, deletedCount: media.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 });
  }
}