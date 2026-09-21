const ID_BASE = Deno.env.get('ID_BASE') ?? 'http://localhost:5173';
const PORT = Number(Deno.env.get('PORT') ?? 4000);
const CLIENT_ID = Deno.env.get('CLIENT_ID') ?? 'demo-client';
const SCOPE = Deno.env.get('SCOPE') ?? 'openid profile email user:read offline_access';
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

type Tokens = {
	access_token: string;
	refresh_token?: string;
	id_token?: string;
	scope?: string;
	expires_in?: number;
};

type Session = {
	pending?: { state: string; verifier: string };
	tokens?: Tokens;
	claims?: Record<string, unknown>;
	userinfo?: Record<string, unknown>;
	note?: string;
};

const sessions = new Map<string, Session>();

let discovery: Record<string, string> | null = null;
async function endpoints() {
	if (!discovery) {
		const res = await fetch(`${ID_BASE}/api/auth/.well-known/openid-configuration`);
		if (!res.ok) throw new Error(`discovery failed: ${res.status}`);
		discovery = await res.json();
	}
	return discovery!;
}

const b64url = (bytes: ArrayBuffer) =>
	btoa(String.fromCharCode(...new Uint8Array(bytes)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

const randomString = () => b64url(crypto.getRandomValues(new Uint8Array(32)).buffer);

const challenge = async (verifier: string) =>
	b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));

const decodeJwt = (jwt: string) =>
	JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));

const readCookie = (req: Request, name: string) =>
	req.headers
		.get('cookie')
		?.split(';')
		.map((c) => c.trim().split('='))
		.find(([k]) => k === name)?.[1];

function sessionFor(req: Request): [string, Session, boolean] {
	const existing = readCookie(req, 'demo_sid');
	if (existing && sessions.has(existing)) return [existing, sessions.get(existing)!, false];
	const sid = randomString();
	const session: Session = {};
	sessions.set(sid, session);
	return [sid, session, true];
}

async function userinfo(token: string) {
	const { userinfo_endpoint } = await endpoints();
	return fetch(userinfo_endpoint, { headers: { authorization: `Bearer ${token}` } });
}

async function tokenRequest(body: Record<string, string>) {
	const { token_endpoint } = await endpoints();
	return fetch(token_endpoint, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ client_id: CLIENT_ID, ...body })
	});
}

const esc = (s: unknown) =>
	String(s).replace(
		/[<>&"]/g,
		(c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!
	);

const page = (body: string, headers: Record<string, string> = {}) =>
	new Response(
		`<!doctype html><meta charset="utf-8"><title>Demo App</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; }
  a.btn { display: inline-block; padding: .5rem 1rem; border: 1px solid #000; color: #000; text-decoration: none; }
  .row { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: 1rem; }
  .note { border: 1px solid #ccc; padding: .5rem .75rem; margin-top: 1rem; }
</style>
${body}`,
		{ headers: { 'content-type': 'text/html; charset=utf-8', ...headers } }
	);

const redirect = (location: string, headers: Record<string, string> = {}) =>
	new Response(null, { status: 303, headers: { location, ...headers } });

async function handler(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const [sid, session, isNew] = sessionFor(req);
	const cookie: Record<string, string> = isNew
		? { 'set-cookie': `demo_sid=${sid}; Path=/; HttpOnly; SameSite=Lax` }
		: {};

	if (url.pathname === '/') {
		let note = session.note;
		delete session.note;

		if (session.tokens) {
			const res = await userinfo(session.tokens.access_token);
			if (res.status === 401) {
				delete session.tokens;
				delete session.claims;
				delete session.userinfo;
				note = 'Token rejected. Signed out.';
			} else if (res.ok) {
				session.userinfo = await res.json();
			}
		}

		if (!session.tokens) {
			return page(
				`<h1>Demo App</h1>
${note ? `<div class="note">${esc(note)}</div>` : ''}
<div class="row"><a class="btn" href="/login">Continue with Purdue Hackers</a></div>`,
				cookie
			);
		}

		const { claims, userinfo: info } = session;
		return page(
			`<h1>Signed in as ${esc(info?.name ?? claims?.sub ?? '?')}</h1>
${note ? `<div class="note">${esc(note)}</div>` : ''}
<div class="row">
  <a class="btn" href="/refresh">Refresh</a>
  <a class="btn" href="/logout">Sign out</a>
</div>`,
			cookie
		);
	}

	if (url.pathname === '/login') {
		const { authorization_endpoint } = await endpoints();
		const state = randomString();
		const verifier = randomString();
		session.pending = { state, verifier };

		const authorize = new URL(authorization_endpoint);
		authorize.searchParams.set('client_id', CLIENT_ID);
		authorize.searchParams.set('redirect_uri', REDIRECT_URI);
		authorize.searchParams.set('response_type', 'code');
		authorize.searchParams.set('scope', SCOPE);
		authorize.searchParams.set('state', state);
		authorize.searchParams.set('code_challenge', await challenge(verifier));
		authorize.searchParams.set('code_challenge_method', 'S256');
		return redirect(authorize.toString(), cookie);
	}

	if (url.pathname === '/callback') {
		const pending = session.pending;
		delete session.pending;

		const error = url.searchParams.get('error');
		if (error) {
			session.note = `${error}: ${url.searchParams.get('error_description') ?? ''}`;
			return redirect('/', cookie);
		}

		const code = url.searchParams.get('code');
		if (!code || !pending || url.searchParams.get('state') !== pending.state) {
			session.note = 'Bad callback.';
			return redirect('/', cookie);
		}

		const res = await tokenRequest({
			grant_type: 'authorization_code',
			code,
			redirect_uri: REDIRECT_URI,
			code_verifier: pending.verifier
		});
		if (!res.ok) {
			session.note = `Token exchange failed: ${res.status}`;
			return redirect('/', cookie);
		}

		const tokens: Tokens = await res.json();
		session.tokens = tokens;
		session.claims = tokens.id_token ? decodeJwt(tokens.id_token) : undefined;
		session.userinfo = await (await userinfo(tokens.access_token)).json();
		return redirect('/', cookie);
	}

	if (url.pathname === '/refresh') {
		if (!session.tokens?.refresh_token) {
			session.note = 'No refresh token.';
			return redirect('/', cookie);
		}
		const res = await tokenRequest({
			grant_type: 'refresh_token',
			refresh_token: session.tokens.refresh_token
		});
		if (!res.ok) {
			session.note = `Refresh failed: ${res.status}`;
			return redirect('/', cookie);
		}
		session.tokens = await res.json();
		session.note = 'Refreshed.';
		return redirect('/', cookie);
	}

	if (url.pathname === '/logout') {
		sessions.delete(sid);
		return redirect('/', { 'set-cookie': 'demo_sid=; Path=/; Max-Age=0' });
	}

	return new Response('Not found', { status: 404 });
}

console.log(`http://localhost:${PORT} -> ${ID_BASE}`);
Deno.serve({ port: PORT }, handler);
