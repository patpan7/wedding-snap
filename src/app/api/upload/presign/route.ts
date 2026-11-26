import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, supabaseAdmin } from '@/lib/clients';

export async function POST(req: Request) {
  try {
    const { eventSlug, fileName, fileType } = await req.json();

    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('slug', eventSlug)
      .single();

    if (eventError || !event) {
      console.error('Supabase error:', eventError);
      return NextResponse.json(
        { error: `Σφάλμα βάσης: ${eventError?.message || 'Δεν βρέθηκε το slug'} (slug: "${eventSlug}")` },
        { status: 404 }
      );
    }

    const ext = fileName.split('.').pop() || 'jpg';
    const fileKey = `${eventSlug}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: fileKey,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 600 });
    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${fileKey}`;

    return NextResponse.json({
      uploadUrl,
      fileKey,
      publicUrl,
      eventId: event.id,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Σφάλμα διακομιστή' }, { status: 500 });
  }
}