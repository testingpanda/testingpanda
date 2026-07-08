import { getEnv } from "@/lib/env";
import type { LLMProvider } from "@/lib/llm/types";
import { MockLLMProvider } from "@/lib/llm/mock";
import { OpenAIProvider } from "@/lib/llm/openai";
import { AnthropicProvider } from "@/lib/llm/anthropic";

let cached: LLMProvider | null = null;

/**
 * Provider factory. Swapping LLM_PROVIDER in .env is the only change needed
 * to move between mock/openai/anthropic — no calling code depends on a
 * specific provider.
 */
export function getLLMProvider(): LLMProvider {
  if (cached) return cached;
  const env = getEnv();
  switch (env.LLM_PROVIDER) {
    case "openai":
      cached = new OpenAIProvider();
      break;
    case "anthropic":
      cached = new AnthropicProvider();
      break;
    default:
      cached = new MockLLMProvider();
  }
  return cached!;
}

export type { LLMProvider, ClassificationResult, ExtractionRawResult, FieldSpec } from "@/lib/llm/types";
