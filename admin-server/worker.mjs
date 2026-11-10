// Indigo Academy West: sign-in server for the admin panel (Cloudflare Worker, no dependencies).
//
// Editors sign in with a username and a short password. The worker keeps the editors in a KV
// namespace (passwords only as PBKDF2 hashes), locks an account after repeated wrong passwords,
// and passes the panel's GitHub requests on with the school's own GitHub token. Editors never see
// that token, and the worker lets them change only content/*.json and photos under assets/img/.
//
// Bindings (wrangler.toml): USERS (KV namespace), vars GITHUB_REPO = "owner/repo", BRANCH, ALLOWED_ORIGINS
// Secrets: GITHUB_TOKEN (fine-grained: Contents read & write, Actions read), SETUP_CODE (first admin only)

const PASSWORD_RE = /^[A-Za-z0-9]{4,6}$/;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const PBKDF2_ITER = 100000;          // the most Workers' WebCrypto allows
const SESSION_TTL = 12 * 3600;       // seconds
const MAX_FAILS_USER = 5;            // wrong passwords before an account is locked…
const MAX_FAILS_IP = 20;             // …or before an address is locked
const LOCK_TTL = 15 * 60;            // …for this many seconds
const TREE_TTL = 3600;               // trees made through the worker may be committed within an hour
// The only files an editor may change
const EDITABLE = [/^content\/(en|ky|ru|site)\.json$/, /^assets\/img\/(photos|staff)\/[A-Za-z0-9/_.-]+\.(jpe?g|png|webp)$/];

const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const randomToken = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (s) => b64url(await crypto.subtle.digest('SHA-256', enc.encode(s)));

async function hashPassword(password, saltB64) {
  const salt = saltB64 ? fromB64url(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, key, 256);
  return { salt: b64url(salt), hash: b64url(bits) };
}
function sameString(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ---------- KV records ----------
// user:<username> → { username, name, role: 'admin'|'editor', active, salt, hash, created, lastLogin }
// sess:<sha256(token)> → { username }                     (TTL = SESSION_TTL)
// fail:u:<username> / fail:ip:<address> → count            (TTL = LOCK_TTL)
// tree:<sha>, commit:<sha> → username                       (TTL = TREE_TTL)
const getUser = (env, u) => env.USERS.get('user:' + u, 'json');
const putUser = (env, rec) => env.USERS.put('user:' + rec.username, JSON.stringify(rec));
async function listUsers(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.USERS.list({ prefix: 'user:', cursor });
    for (const k of page.keys) { const u = await env.USERS.get(k.name, 'json'); if (u) out.push(u); }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out.sort((a, b) => (a.role === b.role ? a.username.localeCompare(b.username) : a.role === 'admin' ? -1 : 1));
}
const publicUser = (u) => ({ username: u.username, name: u.name, role: u.role, active: u.active !== false, created: u.created, lastLogin: u.lastLogin || null });

async function bump(env, key) {
  const n = (parseInt(await env.USERS.get(key), 10) || 0) + 1;
  await env.USERS.put(key, String(n), { expirationTtl: LOCK_TTL });
  return n;
}
const failCount = async (env, key) => parseInt(await env.USERS.get(key), 10) || 0;

// ---------- HTTP helpers ----------
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const fail = (code, status, extra) => reply({ error: code, message: code, ...extra }, status);

async function session(request, env) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer\s+(\S+)$/);
  if (!m) return null;
  const s = await env.USERS.get('sess:' + await sha256(m[1]), 'json');
  if (!s) return null;
  const user = await getUser(env, s.username);
  if (!user || user.active === false) return null;
  return { user, key: 'sess:' + await sha256(m[1]) };
}

// ---------- GitHub pass-through ----------
async function github(env, method, path, body) {
  const r = await fetch('https://api.github.com' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + env.GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'indigo-west-admin',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  return { status: r.status, data };
}
const headSha = async (env, repo) => (await github(env, 'GET', `/repos/${repo}/git/ref/heads/${env.BRANCH || 'main'}`)).data.object?.sha;

// The panel calls the same paths as the GitHub API under /gh/…; only the requests it needs are allowed.
async function proxy(request, env, user, ghPath, search) {
  const repo = env.GITHUB_REPO, branch = env.BRANCH || 'main';
  const base = `/repos/${repo}`;
  const method = request.method;
  const sha = '[0-9a-f]{40}';
  const is = (re) => new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + re + '$').test(ghPath);
  const pass = async (body) => { const r = await github(env, method, ghPath + (search || ''), body); return reply(r.data, r.status); };
  let body = null;
  if (method === 'POST' || method === 'PATCH') { try { body = await request.json(); } catch { return fail('bad_json', 400); } }

  if (method === 'GET' && (ghPath === base || is(`/git/ref/heads/${branch}`) || is(`/git/commits/${sha}`) || is(`/git/trees/${sha}`) || is(`/git/blobs/${sha}`) ||
    is(`/compare/${sha}\\.\\.\\.${sha}`) || is('/actions/runs'))) {
    if (is('/actions/runs') && !/^\?head_sha=[0-9a-f]{40}(&per_page=\d+)?$/.test(search || '')) return fail('forbidden', 403);
    if (is(`/git/trees/${sha}`) && search && search !== '?recursive=1') return fail('forbidden', 403);
    return pass();
  }
  if (method === 'POST' && is('/git/blobs')) {
    if (typeof body.content !== 'string' || !['utf-8', 'base64'].includes(body.encoding)) return fail('bad_request', 400);
    return pass({ content: body.content, encoding: body.encoding });
  }
  if (method === 'POST' && is('/git/trees')) {
    // A new tree must start from the newest published version and change only editable files.
    const head = await headSha(env, repo);
    const headCommit = (await github(env, 'GET', `${base}/git/commits/${head}`)).data;
    if (!body.base_tree || body.base_tree !== headCommit.tree?.sha) return fail('stale', 409);
    if (!Array.isArray(body.tree) || !body.tree.length || body.tree.length > 200) return fail('bad_request', 400);
    for (const e of body.tree) {
      if (!e || typeof e.path !== 'string' || !EDITABLE.some((re) => re.test(e.path)) || e.path.includes('..')) return fail('path_not_allowed', 403, { path: e && e.path });
      if (e.mode !== '100644' || e.type !== 'blob' || !(e.sha === null || new RegExp('^' + sha + '$').test(e.sha))) return fail('bad_request', 400);
    }
    const r = await github(env, 'POST', `${base}/git/trees`, { base_tree: body.base_tree, tree: body.tree.map((e) => ({ path: e.path, mode: '100644', type: 'blob', sha: e.sha })) });
    if (r.status === 201) await env.USERS.put('tree:' + r.data.sha, user.username, { expirationTtl: TREE_TTL });
    return reply(r.data, r.status);
  }
  if (method === 'POST' && is('/git/commits')) {
    // Only trees this editor made through the worker, on top of the newest version, signed with the editor's name.
    if ((await env.USERS.get('tree:' + body.tree)) !== user.username) return fail('forbidden', 403);
    const head = await headSha(env, repo);
    if (!Array.isArray(body.parents) || body.parents.length !== 1 || body.parents[0] !== head) return fail('stale', 409);
    const note = String(body.message || 'Update site content').split('\n')[0].slice(0, 120);
    const r = await github(env, 'POST', `${base}/git/commits`, {
      message: `${note}\n\nPublished from the admin panel by ${user.name || user.username} (${user.username}).`,
      tree: body.tree, parents: [head],
      author: { name: user.name || user.username, email: `${user.username}@editors.indigo-west.invalid` },
    });
    if (r.status === 201) await env.USERS.put('commit:' + r.data.sha, user.username, { expirationTtl: TREE_TTL });
    return reply(r.data, r.status);
  }
  if (method === 'PATCH' && is(`/git/refs/heads/${branch}`)) {
    // Only to a commit this editor just made through the worker (never back to an old version)
    if (typeof body.sha !== 'string' || (await env.USERS.get('commit:' + body.sha)) !== user.username) return fail('forbidden', 403);
    return pass({ sha: body.sha, force: false });
  }
  return fail('forbidden', 403);
}

// ---------- routes ----------
async function handle(request, env, url) {
  const p = url.pathname.replace(/\/+$/, '');
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const body = async () => { try { return await request.json(); } catch { return {}; } };

  if (p === '/status' && request.method === 'GET') {
    const any = await env.USERS.list({ prefix: 'user:', limit: 1 });
    return reply({ setup: any.keys.length === 0, repo: env.GITHUB_REPO, passwordRule: '4-6 letters and digits' });
  }

  // First administrator: only while there are no users, and only with the setup code.
  if (p === '/setup' && request.method === 'POST') {
    const any = await env.USERS.list({ prefix: 'user:', limit: 1 });
    if (any.keys.length) return fail('already_set_up', 409);
    const b = await body();
    if (!env.SETUP_CODE || typeof b.setupCode !== 'string' || !sameString(b.setupCode, env.SETUP_CODE)) {
      await bump(env, 'fail:ip:' + ip);
      return fail('bad_setup_code', 401);
    }
    const err = validateNew(b);
    if (err) return fail(err, 400);
    const { salt, hash } = await hashPassword(b.password);
    await putUser(env, { username: b.username, name: String(b.name || '').trim().slice(0, 60) || b.username, role: 'admin', active: true, salt, hash, created: new Date().toISOString() });
    return reply({ ok: true });
  }

  if (p === '/login' && request.method === 'POST') {
    const b = await body();
    const username = String(b.username || '').trim().toLowerCase();
    const password = String(b.password || '');
    const ipKey = 'fail:ip:' + ip, userKey = 'fail:u:' + username;
    if ((await failCount(env, ipKey)) >= MAX_FAILS_IP || (await failCount(env, userKey)) >= MAX_FAILS_USER) return fail('locked', 429, { retryAfter: LOCK_TTL });
    const user = USERNAME_RE.test(username) ? await getUser(env, username) : null;
    // Hash even for unknown names so the answer takes the same time either way.
    const { hash } = await hashPassword(password, user ? user.salt : b64url(new Uint8Array(16)));
    if (!user || user.active === false || !sameString(hash, user.hash)) {
      const n = await bump(env, userKey);
      await bump(env, ipKey);
      return fail(n >= MAX_FAILS_USER ? 'locked' : 'bad_login', n >= MAX_FAILS_USER ? 429 : 401, { attemptsLeft: Math.max(0, MAX_FAILS_USER - n) });
    }
    await env.USERS.delete(userKey);
    const token = randomToken();
    await env.USERS.put('sess:' + await sha256(token), JSON.stringify({ username }), { expirationTtl: SESSION_TTL });
    user.lastLogin = new Date().toISOString();
    await putUser(env, user);
    return reply({ token, user: publicUser(user), expiresIn: SESSION_TTL });
  }

  const s = await session(request, env);
  if (!s) return fail('signed_out', 401);
  const me = s.user;

  if (p === '/logout' && request.method === 'POST') { await env.USERS.delete(s.key); return reply({ ok: true }); }
  if (p === '/me' && request.method === 'GET') return reply({ user: publicUser(me) });
  if (p === '/me/password' && request.method === 'POST') {
    const b = await body();
    const { hash } = await hashPassword(String(b.current || ''), me.salt);
    if (!sameString(hash, me.hash)) return fail('bad_password', 401);
    if (!PASSWORD_RE.test(String(b.password || ''))) return fail('weak_password', 400);
    Object.assign(me, await hashPassword(b.password));
    await putUser(env, me);
    return reply({ ok: true });
  }

  if (p.startsWith('/gh/')) return proxy(request, env, me, p.slice(3), url.search);

  // Managing editors: administrators only
  if (p === '/users' || p.startsWith('/users/')) {
    if (me.role !== 'admin') return fail('forbidden', 403);
    if (p === '/users' && request.method === 'GET') return reply({ users: (await listUsers(env)).map(publicUser) });
    if (p === '/users' && request.method === 'POST') {
      const b = await body();
      const err = validateNew(b);
      if (err) return fail(err, 400);
      if (await getUser(env, b.username)) return fail('username_taken', 409);
      const { salt, hash } = await hashPassword(b.password);
      const rec = { username: b.username, name: String(b.name || '').trim().slice(0, 60) || b.username, role: b.role === 'admin' ? 'admin' : 'editor', active: true, salt, hash, created: new Date().toISOString() };
      await putUser(env, rec);
      return reply({ user: publicUser(rec) }, 201);
    }
    const target = decodeURIComponent(p.slice('/users/'.length));
    const rec = await getUser(env, target);
    if (!rec) return fail('not_found', 404);
    const admins = async () => (await listUsers(env)).filter((u) => u.role === 'admin' && u.active !== false);
    if (request.method === 'PATCH') {
      const b = await body();
      if (b.name !== undefined) rec.name = String(b.name).trim().slice(0, 60) || rec.username;
      if (b.password !== undefined) {
        if (!PASSWORD_RE.test(String(b.password))) return fail('weak_password', 400);
        Object.assign(rec, await hashPassword(b.password));
      }
      const losesAdmin = (b.role === 'editor' && rec.role === 'admin') || (b.active === false && rec.role === 'admin' && rec.active !== false);
      if (losesAdmin && (await admins()).length <= 1) return fail('last_admin', 409);
      if (b.role !== undefined) rec.role = b.role === 'admin' ? 'admin' : 'editor';
      if (b.active !== undefined) rec.active = !!b.active;
      await putUser(env, rec);
      return reply({ user: publicUser(rec) });
    }
    if (request.method === 'DELETE') {
      if (rec.username === me.username) return fail('cannot_delete_self', 409);
      if (rec.role === 'admin' && (await admins()).length <= 1) return fail('last_admin', 409);
      await env.USERS.delete('user:' + rec.username);
      return reply({ ok: true });
    }
  }
  return fail('not_found', 404);
}

function validateNew(b) {
  if (!USERNAME_RE.test(String(b.username || ''))) return 'bad_username';
  if (!PASSWORD_RE.test(String(b.password || ''))) return 'weak_password';
  return null;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    let res;
    try { res = await handle(request, env, url); } catch (e) { res = fail('server_error', 500); }
    const out = new Response(res.body, res);
    Object.entries(cors).forEach(([k, v]) => out.headers.set(k, v));
    return out;
  },
};
