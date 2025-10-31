#!/usr/bin/env node
import { resolve, join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync } from 'fs';
import { config } from 'dotenv';
import { loadScenario } from '../loader/scenario-loader.js';
import { runScenario } from './agent-runner.js';
import { mcpData, mcpWeb } from '../mcp/client.js';
import { generateReportFromFiles } from '../report/generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../../../..');

config({ path: resolve(PROJECT_ROOT, '.env') });

function expandGlob(pattern: string): string[] {
  const baseDir = dirname(pattern);
  const filePattern = basename(pattern);
  
  if (!filePattern.includes('*')) {
    return [pattern];
  }
  
  try {
    const files = readdirSync(baseDir);
    const regex = new RegExp('^' + filePattern.replace(/\*/g, '.*') + '$');
    return files
      .filter(f => regex.test(f))
      .map(f => join(baseDir, f));
  } catch {
    return [];
  }
}

async function runReportCommand(args: string[]) {
  if (args.length === 0) {
    console.error('Usage: npm run agent report <jsonl-files...>');
    console.error('Example: npm run agent report out/*.jsonl');
    console.error('Example: npm run agent report out/login-and-dashboard_*.jsonl');
    process.exit(1);
  }

  console.log('Agentic Testing Framework - Report Generator');
  console.log('============================================\n');

  const allFiles: string[] = [];
  for (const pattern of args) {
    const resolvedPattern = resolve(PROJECT_ROOT, pattern);
    const files = expandGlob(resolvedPattern);
    allFiles.push(...files);
  }

  if (allFiles.length === 0) {
    console.error('✗ No JSONL files found matching pattern(s)');
    process.exit(1);
  }

  console.log(`Found ${allFiles.length} JSONL file(s):`);
  allFiles.forEach(f => console.log(`  - ${basename(f)}`));

  const outputDir = resolve(PROJECT_ROOT, 'out', 'reports');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = join(outputDir, `report_${timestamp}.html`);

  console.log('\nGenerating report...');

  try {
    const reportPath = generateReportFromFiles(allFiles, {
      outputPath,
      title: 'Agentic Testing Report',
      includeDetails: true
    });

    console.log(`\n✓ Report generated successfully!`);
    console.log(`  Output: ${reportPath}`);
    console.log(`\nOpen in browser:`);
    console.log(`  open ${reportPath}`);
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Failed to generate report:', error);
    process.exit(1);
  }
}

async function runSingleScenario(scenarioPath: string): Promise<{ success: boolean; outputPath: string }> {
  const outputDir = resolve(PROJECT_ROOT, 'out');
  const scenarioName = basename(scenarioPath, '.yaml');
  const outputPath = join(outputDir, `${scenarioName}_${Date.now()}.jsonl`);

  try {
    const spec = loadScenario(scenarioPath);
    console.log(`  Loaded: ${spec.id}`);
    console.log(`  Goal: ${spec.goal.description}`);
    console.log(`  Max steps: ${spec.constraints.max_steps}`);
    console.log(`  Max cost: $${spec.constraints.max_cost_usd}`);

    console.log(`\n  Output: ${outputPath}`);
    console.log('  Starting execution...');
    console.log('  ' + '='.repeat(76));

    const result = await runScenario(spec, outputPath);

    console.log('  ' + '='.repeat(76));
    console.log(`  Status: ${result.status}`);
    console.log(`  Steps: ${result.totalSteps}`);
    console.log(`  Duration: ${result.duration.toFixed(2)}s`);
    console.log(`  Cost: $${result.totalCost.toFixed(4)}`);
    console.log(`  Log: ${outputPath}`);

    if (result.status === 'success') {
      console.log('  ✓ SUCCESS');
      return { success: true, outputPath };
    } else {
      console.log(`  ✗ FAILED: ${result.error}`);
      return { success: false, outputPath };
    }
  } catch (error) {
    console.error(`  ✗ Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, outputPath };
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm run agent <scenario.yaml> [scenario2.yaml ...]');
    console.error('       npm run agent report <jsonl-files...>');
    console.error('');
    console.error('Examples:');
    console.error('  npm run agent scenarios/smoke/login-and-dashboard.yaml');
    console.error('  npm run agent scenarios/smoke/*.yaml');
    console.error('  npm run agent report out/*.jsonl');
    process.exit(1);
  }

  if (args[0] === 'report') {
    await runReportCommand(args.slice(1));
    return;
  }

  const scenarioPaths = args.map(arg => resolve(PROJECT_ROOT, arg));

  console.log('Agentic Testing Framework');
  console.log('========================\n');

  console.log('Checking MCP servers...');
  
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

  console.log('\n' + '='.repeat(80));
  console.log(`Running ${scenarioPaths.length} scenario(s)`);
  console.log('='.repeat(80));

  const results = [];
  for (let i = 0; i < scenarioPaths.length; i++) {
    const scenarioPath = scenarioPaths[i];
    console.log(`\n[${i + 1}/${scenarioPaths.length}] ${basename(scenarioPath)}`);
    console.log('-'.repeat(80));
    
    const result = await runSingleScenario(scenarioPath);
    results.push({ path: scenarioPath, ...result });
  }

  console.log('\n' + '='.repeat(80));
  console.log('All Scenarios Complete!');
  console.log('='.repeat(80));

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  console.log(`\n✓ Passed: ${successCount}/${results.length}`);
  if (failCount > 0) {
    console.log(`✗ Failed: ${failCount}/${results.length}`);
  }

  console.log('\nResults:');
  results.forEach((r, i) => {
    const status = r.success ? '✓' : '✗';
    console.log(`  ${status} ${basename(r.path)}`);
  });

  console.log('\nGenerate report:');
  console.log(`  npm run agent report out/*.jsonl`);

  process.exit(failCount > 0 ? 1 : 0);
}

main();

