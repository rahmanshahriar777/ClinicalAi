# Rotating JWT_SECRET (local auth mode)

1. Generate: `openssl rand -base64 48`
2. Update the secret in your secret manager (AWS Secrets Manager `clinical/api/JWT_SECRET`).
3. Roll the API service. Access tokens signed with the old secret become invalid immediately (≤15 min impact);
   refresh tokens are opaque and unaffected, so clients re-authenticate transparently via `/auth/refresh`.
4. Confirm `USER_LOGIN`/`TOKEN_REFRESHED` audit events continue and no spike in `UNAUTHENTICATED` errors after 15 minutes.
