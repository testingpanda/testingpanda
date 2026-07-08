import OpenAI from "openai";
import type { DocumentClassification } from "@prisma/client";
import { getEnv } from "@/lib/env";
import type { ClassificationResult, ExtractionRawResult, FieldSpec, LLMProvider } from "@/lib/llm/types";
import { buildClassificationPrompt, buildExtractionPrompt } from "@/lib/llm/prompts";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor() {
    const env = getEnv();
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.model = env.OPENAI_MODEL;
  }

  private async completeJSON(system: string, user: string): Promise<unknown> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const content = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(content);
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
