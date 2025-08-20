import { PostgresStore } from '@mastra/pg';

function buildPgConfigFromUrl(urlString: string) {
  const url = new URL(urlString);
  const sslMode = (url.searchParams.get('sslmode') || '').toLowerCase();

  const config: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean | { rejectUnauthorized: boolean };
  } = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    database: url.pathname.replace(/^\//, ''),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };

  // If sslmode indicates TLS, but we might be behind a self-signed proxy (e.g., some PaaS),
  // allow opting-out of strict verification via PG_SSL_REJECT_UNAUTHORIZED env or sslmode=no-verify.
  const envRejectUnauthorized = process.env.PG_SSL_REJECT_UNAUTHORIZED;
  const rejectUnauthorized = typeof envRejectUnauthorized === 'string'
    ? envRejectUnauthorized.toLowerCase() !== 'false'
    : sslMode !== 'no-verify';

  if (sslMode && sslMode !== 'disable') {
    config.ssl = { rejectUnauthorized };
  }

  // If sslmode is absent but the platform requires TLS (e.g., Supabase on prod),
  // default to enabling SSL but not blocking on unknown CA unless explicitly requested.
  if (!sslMode) {
    config.ssl = { rejectUnauthorized };
  }

  return config;
}

// Single, shared storage instance for the whole Mastra app
export const storage = (() => {
  const url = process.env.DATABASE_URL;
  if (url && url.trim() !== '') {
    // Use explicit object config so we can control SSL verification behavior.
    return new PostgresStore(buildPgConfigFromUrl(url));
  }
  // Fallback to default behavior (will likely fail fast informing about missing config)
  return new PostgresStore({ connectionString: '' });
})();


