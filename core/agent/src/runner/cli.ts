#!/usr/bin/env node
import { resolve, join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { loadScenario } from '../loader/scenario-loader.js';
import { runScenario } from './agent-runner.js';
import { mcpData, mcpWeb } from '../mcp/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../../../..');

config({ path: resolve(PROJECT_ROOT, '.env') });

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run agent <scenario.yaml>');
    console.error('Example: npm run agent scenarios/smoke/login-and-dashboard.yaml');
    process.exit(1);
  }

  const scenarioPath = resolve(PROJECT_ROOT, args[0]);
  const outputDir = resolve(PROJECT_ROOT, 'out');
  const scenarioName = basename(scenarioPath, '.yaml');
  const outputPath = join(outputDir, `${scenarioName}_${Date.now()}.jsonl`);

  console.log('Agentic Testing Framework - Phase 3');
  console.log('====================================\n');

  try {
    console.log(`Loading scenario: ${scenarioPath}`);
    const spec = loadScenario(scenarioPath);
    console.log(`✓ Loaded: ${spec.id}`);
    console.log(`  Goal: ${spec.goal.description}`);
    console.log(`  Max steps: ${spec.constraints.max_steps}`);
    console.log(`  Max cost: $${spec.constraints.max_cost_usd}`);

    console.log('\nChecking MCP servers...');
    
    try {
      const webHealth = await mcpWeb.health();
      console.log(`✓ MCP-Web: ${webHealth.ok ? 'healthy' : 'unhealthy'}`);
    } catch (error) {
      console.error('✗ MCP-Web: not responding');
      console.error('  Start with: npm run start:mcp-web');
      process.exit(1);
    }

    try {
      const dataHealth = await mcpData.health();
      console.log(`✓ MCP-Data: ${dataHealth.ok ? 'healthy' : 'unhealthy'}`);
    } catch (error) {
      console.error('✗ MCP-Data: not responding');
      console.error('  Start with: npm run start:mcp-data');
      process.exit(1);
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('\n✗ OPENAI_API_KEY environment variable not set');
      console.error('  Create .env file in project root with: OPENAI_API_KEY=sk-...');
      process.exit(1);
    }
    console.log('✓ OpenAI API key configured');
    console.log(`  Model: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
    console.log(`  MCP-Web: ${process.env.MCP_WEB_URL || 'http://localhost:7001'}`);
    console.log(`  MCP-Data: ${process.env.MCP_DATA_URL || 'http://localhost:7002'}`);

    console.log(`\nOutput: ${outputPath}`);
    console.log('\nStarting scenario execution...');
    console.log('='.repeat(80));

    const result = await runScenario(spec, outputPath);

    console.log('='.repeat(80));
    console.log('\nScenario Complete!');
    console.log(`Status: ${result.status}`);
    console.log(`Steps: ${result.totalSteps}`);
    console.log(`Duration: ${result.duration.toFixed(2)}s`);
    console.log(`Total cost: $${result.totalCost.toFixed(4)}`);
    console.log(`Log: ${outputPath}`);

    if (result.status === 'success') {
      console.log('\n✓ SUCCESS');
      process.exit(0);
    } else {
      console.log(`\n✗ FAILED: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ Fatal error:', error);
    process.exit(1);
  }
}

main();

