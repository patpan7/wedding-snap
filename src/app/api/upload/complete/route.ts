import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/clients';

export async function POST(req: Request) {
  try {
    const { eventId, fileKey, publicUrl, fileHash, mimeType, guestId, guestName, wish, takenAt } =
      await req.json();

    if (!mimeType || typeof mimeType !== 'string') {
      return NextResponse.json({ error: 'Μη έγκυπος τύπος αρχείου' }, { status: 400 });
    }

    const isVideo = mimeType.startsWith('video/');
    const isImage = mimeType.startsWith('image/');
    if (!isVideo && !isImage) {
      return NextResponse.json({ error: 'Μη υποστηριζόμενος τύπος αρχείου' }, { status: 400 });
    }

    const { data: event } = await supabaseAdmin
      .from('events')
      .select('allow_videos')
      .eq('id', eventId)
      .single();

    if (isVideo && event?.allow_videos === false) {
      return NextResponse.json({ error: 'Τα βίντεο δεν επιτρέπονται σε αυτή την εκδήλωση' }, { status: 400 });
    }

    const cleanName = guestName?.trim() || null;

    const { error } = await supabaseAdmin.from('media').upsert(
      {
        event_id: eventId,
        file_key: fileKey,
        public_url: publicUrl,
        file_hash: fileHash,
        mime_type: mimeType,
        guest_id: guestId,
        guest_name: cleanName,
        wish: wish?.trim() || null,
        taken_at: takenAt || new Date().toISOString(),
      },
      { onConflict: 'event_id,file_hash', ignoreDuplicates: true }
    );

    if (error) throw error;

    if (cleanName) {
      await supabaseAdmin
        .from('media')
        .update({ guest_name: cleanName })
        .eq('event_id', eventId)
        .eq('guest_id', guestId)
        .is('guest_name', null);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Αποτυχία καταχώρησης' }, { status: 500 });
  }
}