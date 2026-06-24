const CLIENT_ID = (import.meta as unknown as { env: Record<string, string> }).env.VITE_GOOGLE_CLIENT_ID ?? ''
const REDIRECT_URI = typeof window !== 'undefined' ? window.location.origin : ''
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly'

const K = {
  accessToken:  'gmail_access_token',
  refreshToken: 'gmail_refresh_token',
  expiresAt:    'gmail_expires_at',
  codeVerifier: 'gmail_code_verifier',
  userEmail:    'gmail_user_email',
}

function generateVerifier(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function initiateGmailAuth(): Promise<void> {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID is not set — add it to .env.local and Cloudflare Pages env vars.')
  const verifier = generateVerifier()
  const challenge = await generateChallenge(verifier)
  localStorage.setItem(K.codeVerifier, verifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
    state: 'gmail_oauth',
  })

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function handleGmailCallback(code: string): Promise<void> {
  const verifier = localStorage.getItem(K.codeVerifier)
  if (!verifier) throw new Error('OAuth state missing — try connecting again.')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) throw new Error('Gmail token exchange failed — check your Google Cloud redirect URI config.')
  const tokens = await res.json() as { access_token: string; refresh_token?: string; expires_in: number }

  localStorage.setItem(K.accessToken, tokens.access_token)
  if (tokens.refresh_token) localStorage.setItem(K.refreshToken, tokens.refresh_token)
  localStorage.setItem(K.expiresAt, String(Date.now() + tokens.expires_in * 1000))
  localStorage.removeItem(K.codeVerifier)

  // Store connected email for display
  const profile = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  }).then(r => r.json()) as { email?: string }
  if (profile.email) localStorage.setItem(K.userEmail, profile.email)
}

async function refreshToken(): Promise<string | null> {
  const rt = localStorage.getItem(K.refreshToken)
  if (!rt) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: rt, client_id: CLIENT_ID, grant_type: 'refresh_token' }),
  })

  if (!res.ok) { disconnectGmail(); return null }
  const tokens = await res.json() as { access_token: string; expires_in: number }
  localStorage.setItem(K.accessToken, tokens.access_token)
  localStorage.setItem(K.expiresAt, String(Date.now() + tokens.expires_in * 1000))
  return tokens.access_token
}

export async function getGmailToken(): Promise<string | null> {
  const token = localStorage.getItem(K.accessToken)
  if (!token) return null
  const expiresAt = Number(localStorage.getItem(K.expiresAt) ?? 0)
  if (Date.now() > expiresAt - 60_000) return refreshToken()
  return token
}

export function isGmailConnected(): boolean {
  return !!localStorage.getItem(K.accessToken)
}

export function getGmailUserEmail(): string | null {
  return localStorage.getItem(K.userEmail)
}

export function disconnectGmail(): void {
  Object.values(K).forEach(k => localStorage.removeItem(k))
}
