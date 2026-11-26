import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/clients';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const { data: event, error } = await supabaseAdmin
    .from('events')
    .select('title, event_date, cover_url, welcome_message, uploads_enabled, allow_videos, theme_color')
    .eq('slug', slug)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  return NextResponse.json(event, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}