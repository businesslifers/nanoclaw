/**
 * Schema validation for agents.json files.
 *
 * Pure function — no I/O, no dependencies. Callers handle file reading and logging.
 */

export interface AgentDefinition {
  description: string;
  prompt: string;
  tools?: string[];
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
}

export interface ValidationError {
  agent?: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

const VALID_MODELS = new Set(['sonnet', 'opus', 'haiku', 'inherit']);
const KNOWN_KEYS = new Set(['description', 'prompt', 'tools', 'model']);

export function validateAgentDefinitions(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    errors.push({ message: 'Top level must be a JSON object (not null, array, or primitive)' });
    return { valid: false, errors, warnings };
  }

  const entries = Object.entries(data as Record<string, unknown>);

  if (entries.length === 0) {
    errors.push({ message: 'Must define at least one agent' });
    return { valid: false, errors, warnings };
  }

  for (const [name, value] of entries) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      errors.push({ agent: name, message: `Agent "${name}" must be an object` });
      continue;
    }

    const agent = value as Record<string, unknown>;

    if (typeof agent.description !== 'string' || agent.description.trim() === '') {
      errors.push({ agent: name, field: 'description', message: '"description" is required and must be a non-empty string' });
    }

    if (typeof agent.prompt !== 'string' || agent.prompt.trim() === '') {
      errors.push({ agent: name, field: 'prompt', message: '"prompt" is required and must be a non-empty string' });
    }

    if ('tools' in agent && agent.tools !== undefined) {
      if (!Array.isArray(agent.tools) || !agent.tools.every((t: unknown) => typeof t === 'string')) {
        errors.push({ agent: name, field: 'tools', message: '"tools" must be an array of strings' });
      }
    }

    if ('model' in agent && agent.model !== undefined) {
      if (typeof agent.model !== 'string' || !VALID_MODELS.has(agent.model)) {
        errors.push({ agent: name, field: 'model', message: `"model" must be one of: ${[...VALID_MODELS].join(', ')}` });
      }
    }

    for (const key of Object.keys(agent)) {
      if (!KNOWN_KEYS.has(key)) {
        warnings.push({ agent: name, field: key, message: `Unexpected key "${key}"` });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
