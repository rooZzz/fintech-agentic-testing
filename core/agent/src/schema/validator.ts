import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoalSpec } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const schemaPath = join(__dirname, 'goal-spec.schema.json');
const schemaJson = JSON.parse(readFileSync(schemaPath, 'utf-8'));
const validateGoalSpec = ajv.compile(schemaJson);

export function validateSchema(data: unknown): GoalSpec {
  const valid = validateGoalSpec(data);
  
  if (!valid) {
    const errors = validateGoalSpec.errors
      ?.map(err => `${err.instancePath} ${err.message}`)
      .join(', ');
    throw new Error(`Invalid goal specification: ${errors}`);
  }
  
  return data as GoalSpec;
}

