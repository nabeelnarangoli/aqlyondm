import { nameCase } from './name-case.mjs';
// Event invitation emails sent from the academy Gmail account (through the Apps Script mailer).
// Each email has our own subject ("Invitation from Aqlyon Digital Marketing: <event name>"), a branded body with the
// person's reference, and a calendar invitation (invite.ics, METHOD:REQUEST) so Gmail, Outlook and Apple Mail
// show "Add to calendar". Updates and cancellations reuse the same UID with a higher SEQUENCE.
import { TZS, toUTC } from './events.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icsText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDate = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// lines longer than 75 bytes are folded, as the calendar standard asks
function fold(line) {
  const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line;
  const out = []; let cur = '';
  for (const ch of line) { if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ''; } cur += ch; }
  out.push(cur); return out.join('\r\n ');
}

export function eventTimes(e) {
  const start = toUTC(e.start, e.tz), end = e.end ? toUTC(e.end, e.tz) : start + 2 * 3600_000;
  return { start, end };
}
export function whenText(e) {
  const { start, end } = eventTimes(e); const tz = TZS[e.tz] ? e.tz : 'Asia/Kolkata';
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(start);
  const t = (ms) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(ms);
  return `${day}, ${t(start)}${e.end ? ' – ' + t(end) : ''} (${TZS[tz].name})`;
}

export function inviteMail(e, r, kind, { origin = '', organizer = '', seq = 0 } = {}) {
  r = { ...r, name: nameCase(r.name) };
  const { start, end } = eventTimes(e);
  const page = origin ? `${origin}/events/${e.slug}` : '';
  const badge = origin && r.tk ? `${origin}/badge/${r.tk}` : '';
  const online = e.mode === 'online';
  const where = online ? 'Online' : e.locationName || '';
  const join = online && e.onlineUrl ? e.onlineUrl : '';
  const first = String(r.name || '').trim().split(/\s+/)[0] || 'there';
  const cancel = kind === 'cancel';
  const subject = cancel ? `Cancelled: ${e.title} (Aqlyon Digital Marketing)` : kind === 'update' ? `Updated invitation from Aqlyon Digital Marketing: ${e.title}` : `Invitation from Aqlyon Digital Marketing: ${e.title}`;

  const descLines = [e.summary || '', join ? `Join online: ${join}` : '', !online && e.mapUrl ? `Map: ${e.mapUrl}` : '', `Your reference: ${r.ref}`, badge && !cancel ? `Your badge: ${badge}` : '', page ? `Event page: ${page}` : '', 'Aqlyon Digital Marketing'].filter(Boolean);
  const org = organizer || 'mediadesk@aqlyondm.com';
  const ics = ['BEGIN:VCALENDAR', 'PRODID:-//Aqlyon Digital Marketing//Events//EN', 'VERSION:2.0', 'CALSCALE:GREGORIAN', `METHOD:${cancel ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT', `UID:${e.id}-${r.id}@aqlyondm.com`, `SEQUENCE:${seq}`, `DTSTAMP:${icsDate(Date.now())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(e.title)}`, `DESCRIPTION:${icsText(descLines.join('\n'))}`, `LOCATION:${icsText(join || [where, !online ? e.mapUrl : ''].filter(Boolean).join(' · '))}`,
    page ? `URL:${page}` : '', `ORGANIZER;CN=Aqlyon Digital Marketing:mailto:${org}`,
    `ATTENDEE;CN=${icsText(r.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=${cancel ? 'DECLINED' : 'ACCEPTED'};RSVP=FALSE:mailto:${r.email}`,
    `STATUS:${cancel ? 'CANCELLED' : 'CONFIRMED'}`, 'TRANSP:OPAQUE',
    ...(cancel ? [] : ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.title)} is tomorrow`, 'TRIGGER:-P1D', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.title)} starts in 1 hour`, 'TRIGGER:-PT1H', 'END:VALARM']),
    'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).map(fold).join('\r\n');

  const intro = cancel ? `Your registration for <b>${esc(e.title)}</b> has been cancelled, and the event has been removed from your calendar. If you think this is a mistake, just reply to this email.`
    : kind === 'update' ? `The details for <b>${esc(e.title)}</b> have changed. Here is the updated information. Your calendar updates when you open the attached invitation.`
    : `You're registered for <b>${esc(e.title)}</b>. Add it to your calendar with the invitation in this email, and we'll see you there.`;
  const row = (k, v) => `<tr><td style="padding:8px 14px 8px 0;color:#5B6178;font-size:14px;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:8px 0;font-size:15px;color:#1A1E3A">${v}</td></tr>`;
  const whereHtml = online ? (join ? `Online · <a href="${esc(join)}" style="color:#5B3FD6">Join link</a>` : 'Online (we will send the joining link before the event)')
    : `${esc(where)}${e.mapUrl ? ` · <a href="${esc(e.mapUrl)}" style="color:#5B3FD6">Open map</a>` : ''}`;
  const html = `<!doctype html><html><body style="margin:0;background:#F3F4FA;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4FA;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#1A1E3A;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:bold">Aqlyon Digital Marketing</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${cancel ? '#A1262A' : '#5B3FD6'};font-weight:bold">${cancel ? 'Registration cancelled' : kind === 'update' ? 'Event updated' : 'Event invitation'}</p>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#1A1E3A">${esc(e.title)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#1A1E3A">Hi ${esc(first)},<br>${intro}</p>
${cancel ? '' : `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px">${row('When', esc(whenText(e)))}${row('Where', whereHtml)}${row('Reference', `<b>${esc(r.ref)}</b>`)}${r.seats > 1 ? row('People', String(r.seats)) : ''}</table>`}
${badge && !cancel && !online ? `<div style="background:#E3F3EA;border-radius:12px;padding:14px 16px;margin:0 0 16px;font-size:14px;line-height:1.5;color:#0D2B22"><b>Your entry badge</b><br>Show the QR code on your badge at the entrance. Save it on your phone or print it.<br><a href="${esc(badge)}" style="display:inline-block;margin-top:10px;background:#0D2B22;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:999px;font-weight:bold">Open my badge</a></div>` : badge && !cancel ? `<p style="margin:0 0 14px;font-size:14px"><a href="${esc(badge)}" style="color:#5B3FD6">Open my badge</a> (your personal QR code)</p>` : ''}
${page && !cancel ? `<p style="margin:0 0 8px"><a href="${esc(page)}" style="display:inline-block;background:#5B3FD6;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold;font-size:15px">View event page</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #E6E8F2;color:#5B6178;font-size:12px;line-height:1.5">Aqlyon Digital Marketing · You received this because you registered for this event on our website. Reply to this email if you have any questions.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [`Hi ${first},`, '', cancel ? `Your registration for "${e.title}" has been cancelled.` : kind === 'update' ? `The details for "${e.title}" have changed.` : `You're registered for "${e.title}".`,
    ...(cancel ? [] : ['', `When: ${whenText(e)}`, `Where: ${online ? 'Online' + (join ? ' – ' + join : '') : where + (e.mapUrl ? ' – ' + e.mapUrl : '')}`, `Reference: ${r.ref}`, badge ? `Your badge (show the QR code at the entrance): ${badge}` : '', page ? `Event page: ${page}` : '']),
    '', 'Aqlyon Digital Marketing'].join('\n');
  return { to: r.email, subject, html, text, ics, method: cancel ? 'CANCEL' : 'REQUEST' };
}
