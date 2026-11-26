import { NextResponse } from 'next/server';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, supabaseAdmin } from '@/lib/clients';
import { verifyPin, hashPin, validatePinStrength } from '@/lib/pin';

const pinAttempts = new Map<string, { count: number; resetAt: number }>();

function checkPinRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = pinAttempts.get(ip);
  if (!record || now > record.resetAt) {
    pinAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (record.count >= 5) return false;
  record.count++;
  return true;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

async function checkPin(eventPinHash: string, providedPin: string): Promise<boolean> {
  // Support both legacy plaintext PIN and new hashed PIN
  if (eventPinHash.startsWith('$2b$') || eventPinHash.startsWith('$2a$') || eventPinHash.startsWith('$2y$')) {
    return verifyPin(providedPin, eventPinHash);
  }
  // Legacy plaintext comparison (constant-time-ish)
  return eventPinHash === providedPin;
}

// 1. Ανάκτηση στοιχείων & φωτογραφιών
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!checkPinRateLimit(ip)) {
      return NextResponse.json({ error: 'Πολλά αποτυχημένα μηνύματα. Δοκιμάστε ξανά σε ένα λεπτό.' }, { status: 429 });
    }

    const { slug, pin } = await req.json();

    const { data: event } = await supabaseAdmin
      .from('events')
      .select('id, title, event_date, cover_url, welcome_message, uploads_enabled, allow_videos, theme_color, admin_pin')
      .eq('slug', slug)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Η εκδήλωση δεν βρέθηκε' }, { status: 404 });
    }

    if (!(await checkPin(event.admin_pin, pin))) {
      return NextResponse.json({ error: 'Λάθος κωδικός PIN' }, { status: 401 });
    }

    const { data: media, error } = await supabaseAdmin
      .from('media')
      .select('*')
      .eq('event_id', event.id)
      .order('taken_at', { ascending: true });

    if (error) throw error;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { admin_pin: _adminPin, ...safeEvent } = event;
    return NextResponse.json({
      event: safeEvent,
      media: media || [],
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Σφάλμα διακομιστή' }, { status: 500 });
  }
}

// 2. Απόκρυψη / Εμφάνιση φωτογραφίας
export async function PATCH(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!checkPinRateLimit(ip)) {
      return NextResponse.json({ error: 'Πολλά αποτυχημένα μηνύματα. Δοκιμάστε ξανά σε ένα λεπτό.' }, { status: 429 });
    }

    const { slug, pin, mediaId, isApproved } = await req.json();

    const { data: event } = await supabaseAdmin
      .from('events')
      .select('id, admin_pin')
      .eq('slug', slug)
      .single();

    if (!event || !(await checkPin(event.admin_pin, pin))) {
      return NextResponse.json({ error: 'Μη εξουσιοδοτημένη ενέργεια' }, { status: 401 });
    }

    const { error } = await supabaseAdmin
      .from('media')
      .update({ is_approved: isApproved })
      .eq('id', mediaId)
      .eq('event_id', event.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Αποτυχία ενημέρωσης' }, { status: 500 });
  }
}

// 3. Ενημέρωση Ρυθμίσεων & Φωτογραφίας Εξωφύλλου
export async function PUT(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!checkPinRateLimit(ip)) {
      return NextResponse.json({ error: 'Πολλά αποτυχημένα μηνύματα. Δοκιμάστε ξανά σε ένα λεπτό.' }, { status: 429 });
    }

    const body = await req.json();
    const { slug, pin, action } = body;

    const { data: event } = await supabaseAdmin
      .from('events')
      .select('id, admin_pin')
      .eq('slug', slug)
      .single();

    if (!event || !(await checkPin(event.admin_pin, pin))) {
      return NextResponse.json({ error: 'Μη εξουσιοδοτημένη ενέργεια' }, { status: 401 });
    }

    if (action === 'presign') {
      const ext = body.fileName.split('.').pop() || 'jpg';
      const fileKey = `${slug}/cover-${Date.now()}.${ext}`;
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: fileKey,
        ContentType: body.fileType,
      });

      const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });
      const coverUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${fileKey}`;
      return NextResponse.json({ uploadUrl, coverUrl });
    }

    if (action === 'save') {
      const { error } = await supabaseAdmin
        .from('events')
        .update({ cover_url: body.coverUrl })
        .eq('id', event.id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'update_settings') {
      const validation = validatePinStrength(body.new_pin || '');
      if (body.new_pin && body.new_pin.trim().length >= 6) {
        if (!validation.valid) {
          return NextResponse.json({ error: validation.message || 'Πρόβλημα με το PIN' }, { status: 400 });
        }
      }

      const updates: Record<string, unknown> = {
        title: body.title,
        event_date: body.event_date || null,
        welcome_message: body.welcome_message,
        uploads_enabled: body.uploads_enabled,
        allow_videos: body.allow_videos,
        theme_color: body.theme_color,
      };

      if (body.new_pin && body.new_pin.trim().length >= 6) {
        updates.admin_pin = await hashPin(body.new_pin.trim());
      }

      const { error } = await supabaseAdmin
        .from('events')
        .update(updates)
        .eq('id', event.id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Άγνωστη ενέργεια' }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Σφάλμα ενημέρωσης' }, { status: 500 });
  }
}

// 4. Οριστική Διαγραφή Αρχείου (R2 + Supabase)
export async function DELETE(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!checkPinRateLimit(ip)) {
      return NextResponse.json({ error: 'Πολλά αποτυχημένα μηνύματα. Δοκιμάστε ξανά σε ένα λεπτό.' }, { status: 429 });
    }

    const { slug, pin, mediaId, fileKey } = await req.json();

    const { data: event } = await supabaseAdmin
      .from('events')
      .select('id, admin_pin')
      .eq('slug', slug)
      .single();

    if (!event || !(await checkPin(event.admin_pin, pin))) {
      return NextResponse.json({ error: 'Μη εξουσιοδοτημένη ενέργεια' }, { status: 401 });
    }

    // Διαγραφή από Cloudflare R2
    if (fileKey) {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: fileKey,
        })
      );
    }

    // Διαγραφή από Supabase
    const { error } = await supabaseAdmin
      .from('media')
      .delete()
      .eq('id', mediaId)
      .eq('event_id', event.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Αποτυχία διαγραφής' }, { status: 500 });
  }
}