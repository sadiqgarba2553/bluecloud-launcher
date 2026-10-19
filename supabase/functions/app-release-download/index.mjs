// Anonymous desktop clients authenticate with an Ed25519-signed release ticket.
// Only fixed app repositories may be read; this endpoint never writes to GitHub.
const repositories = {
  coneic: 'sadiqgarba2553/coneic',
  quranly: 'sadiqgarba2553/quranly-pc',
  tooldeck: 'sadiqgarba2553/tooldeck',
  launcher: 'sadiqgarba2553/bluecloud-launcher',
};
const spki = 'MCowBQYDK2VwAyEATRxYq/F2sfUOkJdIVmk5AQ8ROyq9lRtTEKcIhsbahMo=';
function decode(value) {
  const text = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(text), c => c.charCodeAt(0));
}
const publicKey = crypto.subtle.importKey('spki', decode(spki), {name: 'Ed25519'}, false, ['verify']);

export async function handle(request, options = {}) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status: 405, headers: {Allow: 'GET, HEAD'}});
  let ticket;
  try {
    const url = new URL(request.url), raw = url.searchParams.get('ticket') || '', signature = url.searchParams.get('signature') || '';
    if (!raw || raw.length > 1500 || !signature || signature.length > 128) throw Error('ticket');
    const bytes = decode(raw);
    if (!await crypto.subtle.verify({name: 'Ed25519'}, options.publicKey || await publicKey, decode(signature), bytes)) throw Error('signature');
    ticket = JSON.parse(new TextDecoder().decode(bytes));
    if (ticket.purpose !== 'bluecloud-app-download-v1' || !Object.hasOwn(repositories, ticket.appId) ||
        !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(ticket.version) ||
        !Number.isFinite(Date.parse(ticket.expiresAt)) || Date.parse(ticket.expiresAt) <= (options.now ?? Date.now())) throw Error('claims');
  } catch {
    return new Response('A valid signed release ticket is required', {status: 401});
  }
  try {
    const name = ticket.appId === 'launcher' ? `BlueCloud-Launcher-Setup-${ticket.version}-x64.exe` : `${ticket.appId}-${ticket.version}-win-x64.zip`;
    const source = `https://github.com/${repositories[ticket.appId]}/releases/download/v${ticket.version}/${name}`;
    const result = await (options.fetch || fetch)(source, {method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20000)});
    const resolved = new URL(result.url);
    if (!result.ok || resolved.protocol !== 'https:' || !['release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(resolved.hostname)) throw Error('upstream');
    await result.body?.cancel();
    return new Response(null, {status: 302, headers: {Location: resolved.href, 'Cache-Control': 'private, no-store'}});
  } catch {
    return new Response('The app release is temporarily unavailable', {status: 502});
  }
}
if (typeof Deno !== 'undefined') Deno.serve(request => handle(request));
