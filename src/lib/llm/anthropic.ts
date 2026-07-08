import Anthropic from "@anthropic-ai/sdk";
import type { DocumentClassification } from "@prisma/client";
import { getEnv } from "@/lib/env";
import type { ClassificationResult, ExtractionRawResult, FieldSpec, LLMProvider } from "@/lib/llm/types";
import { buildClassificationPrompt, buildExtractionPrompt } from "@/lib/llm/prompts";

const EMIT_JSON_TOOL = {
  name: "emit_json",
  description: "Emit the structured JSON result. This is the only way to respond.",
  input_schema: {
    type: "object" as const,
    properties: {},
    additionalProperties: true,
  },
};

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor() {
    const env = getEnv();
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    this.model = env.ANTHROPIC_MODEL;
  }

  private async completeJSON(system: string, user: string): Promise<unknown> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      temperature: 0,
      system,
      messages: [{ role: "user", content: user }],
      tools: [EMIT_JSON_TOOL],
      tool_choice: { type: "tool", name: "emit_json" },
    });
    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return {};
    return toolUse.input;
  }

  async classifyDocument(text: string, candidateTypes: DocumentClassification[]): Promise<ClassificationResult> {
    const { system, user } = buildClassificationPrompt(text, candidateTypes);
    const raw = (await this.completeJSON(system, user)) as Partial<ClassificationResult>;
    return {
      classification: (raw.classification as DocumentClassification) ?? "Other",
      confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
      rationale: raw.rationale ?? "",
    };
  }

  async extractFields(
    documentType: DocumentClassification,
    text: string,
    fieldSpecs: FieldSpec[]
  ): Promise<ExtractionRawResult> {
    const { system, user } = buildExtractionPrompt(documentType, text, fieldSpecs);
    const raw = await this.completeJSON(system, user);
    return { raw, modelName: this.model };
  }
}
