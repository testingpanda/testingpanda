// NODE_ENV is typed read-only by @types/node; test runners still need to force it.
(process.env as Record<string, string>).NODE_ENV = "test";
process.env.APP_ENCRYPTION_KEY ||= "fhvngveE+0iIAleYjvQsHtuCjmTNWzuONfUBmWMJAkc=";
process.env.SESSION_SECRET ||= "test-session-secret-that-is-at-least-32-characters-long";
process.env.DATABASE_URL ||= "postgresql://tax:tax@localhost:5432/geneva_tax_mvp_test?schema=public";
process.env.STORAGE_DRIVER ||= "local";
process.env.STORAGE_LOCAL_DIR ||= "./storage-test";
process.env.LLM_PROVIDER ||= "mock";
process.env.OCR_PROVIDER ||= "stub";
process.env.MALWARE_SCAN_PROVIDER ||= "stub";
