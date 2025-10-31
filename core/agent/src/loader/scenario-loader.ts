import { readFileSync } from 'fs';
import YAML from 'yaml';
import { GoalSpec } from '../schema/types.js';
import { validateSchema } from '../schema/validator.js';

export function loadScenario(filePath: string): GoalSpec {
  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    const parsed = YAML.parse(fileContent);
    
    const validated = validateSchema(parsed);
    
    return validated;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load scenario from ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

