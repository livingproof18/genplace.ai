# Supabase auth wiring (dev)

## Env vars

Set these in `.env.local` for local dev:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never import it in client code.

## Local OAuth test

1. Run `npm run dev`.
2. Open `http://localhost:3000/dev/supabase`.
3. Click "Sign in with Google" or "Sign in with Discord".
4. Complete OAuth and return to `/auth/callback`.
5. Confirm the session output shows a user and access token.
6. Click "Sign out" and confirm the session output is empty.
