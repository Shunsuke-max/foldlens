import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { AssistantRequestSchema, AssistantResponseSchema } from '../src/lib/analysisSchema';
import { buildLocalAssistantResponse } from '../src/lib/analysis';
import type { AssistantEnvelope, AssistantResponse } from '../src/types/analysis';

const model = () => process.env.OPENAI_MODEL || 'gpt-5.6-sol';

export function safeFallbackReason(error: unknown) {
  if (typeof error === 'object' && error !== null && 'status' in error && error.status === 429) {
    return 'Live analysis quota is unavailable';
  }
  return 'Live analysis request failed';
}

function hasUsableKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  return Boolean(key && key.length > 12 && !key.toLowerCase().includes('placeholder'));
}

export const getAnalysisMode = (): 'live' | 'local' => hasUsableKey() && process.env.MOCK_ANALYSIS !== 'true' ? 'live' : 'local';

function systemPrompt() {
  return [
    'You are FoldLens, a careful assistant for interpreting AlphaFold 3 confidence outputs.',
    'Use only the supplied deterministic facts. Do not infer measurements, contacts, mechanisms, or biological truth that are absent.',
    'Treat source=pae domain entries as predicted structural regions, never as named functional domains.',
    'Distinguish prediction confidence from experimental validation. Never make clinical, therapeutic, or efficacy claims.',
    'Lead with the conclusion. Include 1–4 short evidence items copied from the supplied facts and material caveats.',
    'Evidence actions must reference only supplied chain IDs and residue ranges. Use empty arrays and action type none when no grounded action exists.',
    'Keep the answer under 60 words and each interpretation under 18 words. Every schema field is required.',
  ].join('\n');
}

export async function analyzePrediction(rawRequest: unknown): Promise<AssistantEnvelope> {
  const request = AssistantRequestSchema.parse(rawRequest);
  const local = buildLocalAssistantResponse(request.facts, undefined, request.question);
  if (getAnalysisMode() === 'local') return { data: local, source: 'local', model: 'deterministic', fallbackReason: null };

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.parse({
      model: model(),
      reasoning: { effort: 'low' },
      input: [
        { role: 'system', content: systemPrompt() },
        { role: 'user', content: JSON.stringify({ question: request.question, facts: request.facts }) },
      ],
      text: {
        verbosity: 'low',
        format: zodTextFormat(AssistantResponseSchema, 'foldlens_grounded_analysis'),
      },
      max_output_tokens: 1200,
    });
    const parsed = AssistantResponseSchema.safeParse(response.output_parsed as AssistantResponse | null);
    if (!parsed.success) return { data: local, source: 'local', model: model(), fallbackReason: 'Invalid structured output' };
    return { data: parsed.data, source: 'live', model: model(), fallbackReason: null };
  } catch (error) {
    return {
      data: local,
      source: 'local',
      model: model(),
      fallbackReason: safeFallbackReason(error),
    };
  }
}
