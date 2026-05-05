export interface OpenAIPreset {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  keyHint: string;
  keyUrl?: string;
  notes: string;
}

export const OPENAI_PRESETS: OpenAIPreset[] = [
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    keyHint: 'gsk_…',
    keyUrl: 'https://console.groq.com/keys',
    notes: 'Fast, generous free tier',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    keyHint: 'sk-or-…',
    keyUrl: 'https://openrouter.ai/keys',
    notes: '100+ models behind one key (free + paid)',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    keyHint: 'sk-…',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    notes: 'Cheap, strong quality',
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    defaultModel: 'llama-3.3-70b',
    keyHint: 'csk-…',
    keyUrl: 'https://cloud.cerebras.ai',
    notes: 'Fastest inference, generous free tier',
  },
  {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    keyHint: '…',
    keyUrl: 'https://api.together.xyz/settings/api-keys',
    notes: 'Wide model catalog',
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    keyHint: 'fw_…',
    keyUrl: 'https://fireworks.ai/account/api-keys',
    notes: 'Fast Llama hosting',
  },
  {
    id: 'custom',
    label: 'Custom',
    baseUrl: '',
    defaultModel: '',
    keyHint: '…',
    notes: 'Any OpenAI-compatible endpoint',
  },
];

export function findPreset(id: string): OpenAIPreset | undefined {
  return OPENAI_PRESETS.find((p) => p.id === id);
}
