import { describe, it, expect } from 'vitest';
import {
  recommendedOption,
  costTier,
  formatCostPerPost,
  geminiTier,
  parseGeminiModels,
  parseOpenAIModels,
} from '@/lib/llm/models';

describe('parseGeminiModels', () => {
  const gen = ['generateContent'];
  const entries = [
    { name: 'models/gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash-Lite', supportedGenerationMethods: gen },
    { name: 'models/gemini-3.5-flash', displayName: 'Gemini 3.5 Flash', supportedGenerationMethods: gen },
    { name: 'models/gemini-3.1-pro-preview', supportedGenerationMethods: gen },
    { name: 'models/gemini-2.5-flash-preview-tts', supportedGenerationMethods: gen },
    { name: 'models/gemini-3-pro-image', supportedGenerationMethods: gen },
    { name: 'models/gemini-omni-1.2-flash', supportedGenerationMethods: gen },
    { name: 'models/gemma-4-31b-it', supportedGenerationMethods: gen },
    { name: 'models/lyria-3.5', supportedGenerationMethods: gen },
    { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
  ];

  it('keeps only text Gemini models that serve generateContent, cheapest tier first', () => {
    expect(parseGeminiModels(entries).map((m) => m.id)).toEqual([
      'gemini-2.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.1-pro-preview',
    ]);
  });

  it('tiers by family name', () => {
    expect(geminiTier('gemini-flash-lite-latest')).toBe('cheap');
    expect(geminiTier('gemini-3.5-flash')).toBe('standard');
    expect(geminiTier('gemini-pro-latest')).toBe('premium');
  });
});

describe('parseOpenAIModels', () => {
  it('reads an OpenRouter-style catalog, drops non-JSON and non-text models, sorts by cost', () => {
    const payload = {
      data: [
        {
          id: 'big/model',
          pricing: { prompt: '0.000003', completion: '0.000015' },
          supported_parameters: ['response_format'],
          architecture: { output_modalities: ['text'] },
        },
        {
          id: 'tiny/model',
          pricing: { prompt: '0.00000005', completion: '0.0000001' },
          supported_parameters: ['response_format', 'temperature'],
          architecture: { output_modalities: ['text'] },
        },
        {
          id: 'free/model:free',
          pricing: { prompt: '0', completion: '0' },
          supported_parameters: ['structured_outputs'],
          architecture: { output_modalities: ['text'] },
        },
        {
          id: 'nojson/model',
          pricing: { prompt: '0.0000001', completion: '0.0000001' },
          supported_parameters: ['temperature'],
        },
        { id: 'paint/model', architecture: { output_modalities: ['image'] } },
      ],
    };
    const list = parseOpenAIModels(payload);
    expect(list.map((m) => [m.id, m.tier])).toEqual([
      ['free/model:free', 'free'],
      ['tiny/model', 'cheap'],
      ['big/model', 'premium'],
    ]);
    expect(list[1]!.costPerPost).toBeCloseTo(1200 * 0.00000005 + 700 * 0.0000001);
  });

  it('accepts a bare array and lists unpriced models without a tier', () => {
    const list = parseOpenAIModels([{ id: 'llama-3.3-70b-versatile' }, { id: 'whisper-large-v3' }]);
    expect(list).toEqual([{ id: 'llama-3.3-70b-versatile', tier: 'unknown', costPerPost: undefined }]);
  });

  it('returns an empty list for an unexpected shape', () => {
    expect(parseOpenAIModels({ models: 'nope' })).toEqual([]);
  });
});

describe('recommendedOption', () => {
  const list = parseOpenAIModels({
    data: [
      { id: 'a:free', pricing: { prompt: 0, completion: 0 } },
      { id: 'b-preview', pricing: { prompt: '0.00000001', completion: '0.00000001' } },
      { id: 'c', pricing: { prompt: '0.00000002', completion: '0.00000002' } },
    ],
  });

  it('prefers the cheapest paid, non-preview model over free ones', () => {
    expect(recommendedOption(list)?.id).toBe('c');
  });

  it('uses the preferred id when the catalog has it', () => {
    expect(recommendedOption(list, 'b-preview')?.id).toBe('b-preview');
    expect(recommendedOption(list, 'missing')?.id).toBe('c');
  });

  it('falls back to free when nothing paid is cheap', () => {
    expect(recommendedOption(parseOpenAIModels({ data: [{ id: 'x:free', pricing: { prompt: 0, completion: 0 } }] }))?.id).toBe('x:free');
  });
});

describe('cost formatting', () => {
  it('tiers and formats per-post cost', () => {
    expect(costTier(undefined)).toBe('unknown');
    expect(costTier(0.0005)).toBe('cheap');
    expect(costTier(0.005)).toBe('standard');
    expect(costTier(0.05)).toBe('premium');
    expect(formatCostPerPost(0)).toBe('free');
    expect(formatCostPerPost(0.00003)).toBe('<$0.0001/post');
    expect(formatCostPerPost(0.00042)).toBe('$0.0004/post');
  });
});
