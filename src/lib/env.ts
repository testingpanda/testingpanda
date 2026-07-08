import { z } from "zod";

/**
 * Fail fast on boot rather than at some random point mid-request. Every
 * secret/config knob the app depends on is validated here exactly once.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_ENCRYPTION_KEY: z
    .string()
    .min(32, "APP_ENCRYPTION_KEY must be a base64-encoded 32-byte key (openssl rand -base64 32)"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage-dev"),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_REGION: z.string().optional(),
  STORAGE_S3_ENDPOINT: z.string().optional(),
  STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_S3_FORCE_PATH_STYLE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(120),

  LLM_PROVIDER: z.enum(["mock", "openai", "anthropic"]).default("mock"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),

  OCR_PROVIDER: z.enum(["stub", "tesseract"]).default("stub"),

  MALWARE_SCAN_PROVIDER: z.enum(["stub", "clamav"]).default("stub"),
  CLAMAV_HOST: z.string().optional(),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),

  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(25),

  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_LOGIN_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_UPLOAD_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_UPLOAD_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),

  SEED_DEMO_MODE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  SEED_DEMO_EMAIL: z.string().email().default("demo@example.com"),
  SEED_DEMO_PASSWORD: z.string().min(8).default("DemoPassword123!"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  if (parsed.data.STORAGE_DRIVER === "s3") {
    const required = [
      "STORAGE_S3_BUCKET",
      "STORAGE_S3_REGION",
      "STORAGE_S3_ACCESS_KEY_ID",
      "STORAGE_S3_SECRET_ACCESS_KEY",
    ] as const;
    const missing = required.filter((k) => !parsed.data[k]);
    if (missing.length > 0) {
      throw new Error(`STORAGE_DRIVER=s3 requires: ${missing.join(", ")}`);
    }
  }
  if (parsed.data.LLM_PROVIDER === "openai" && !parsed.data.OPENAI_API_KEY) {
    throw new Error("LLM_PROVIDER=openai requires OPENAI_API_KEY");
  }
  if (parsed.data.LLM_PROVIDER === "anthropic" && !parsed.data.ANTHROPIC_API_KEY) {
    throw new Error("LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY");
  }
  cached = parsed.data;
  return cached;
}
