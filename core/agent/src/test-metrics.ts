import { resolve } from 'path';
import { analyzeScenarioFile, analyzeMultipleScenarios } from './metrics/analyzer.js';

const PROJECT_ROOT = resolve(process.cwd(), '../..');

async function testSingleScenario() {
  console.log('Testing single scenario analysis...\n');
  
  const testFile = resolve(PROJECT_ROOT, 'out/login-and-dashboard_1761922730412.jsonl');
  console.log(`File: ${testFile}`);
  
  try {
    const metrics = analyzeScenarioFile(testFile);
    
    console.log('\nScenario Metrics:');
    console.log(`  Scenario ID: ${metrics.scenarioId}`);
    console.log(`  Status: ${metrics.status}`);
    console.log(`  Total Steps: ${metrics.totalSteps}`);
    console.log(`  Total Cost: $${metrics.totalCost.toFixed(4)}`);
    
    console.log('\nEntropy:');
    console.log(`  Value: ${metrics.entropy.value.toFixed(3)}`);
    console.log(`  Total Interactions: ${metrics.entropy.totalInteractions}`);
    console.log(`  Element Frequencies:`, metrics.entropy.elementFrequencies);
    
    console.log('\nBacktracks:');
    console.log(`  Count: ${metrics.backtracks.count}`);
    console.log(`  URL History: ${metrics.backtracks.urlHistory.join(' → ')}`);
    
    console.log('\nOptimality:');
    console.log(`  Ratio: ${metrics.optimality.ratio.toFixed(3)}`);
    console.log(`  Optimal Steps: ${metrics.optimality.optimalSteps}`);
    console.log(`  Actual Steps: ${metrics.optimality.actualSteps}`);
    
    console.log('\nTiming:');
    console.log(`  Time to First Action: ${metrics.timing.timeToFirstAction.toFixed(2)}s`);
    console.log(`  Total Duration: ${metrics.timing.totalDuration.toFixed(2)}s`);
    console.log(`  Avg Step Latency: ${metrics.timing.avgStepLatency.toFixed(2)}s`);
    
    console.log('\n✓ Single scenario test passed\n');
    return true;
  } catch (error) {
    console.error('✗ Single scenario test failed:', error);
    return false;
  }
}

async function testMultipleScenarios() {
  console.log('Testing multiple scenarios analysis...\n');
  
  const files = [
    'out/login-and-dashboard_1761922730412.jsonl',
    'out/get-to-credit-report_1761923148738.jsonl'
  ].map(f => resolve(PROJECT_ROOT, f));
  
  console.log(`Files: ${files.length}`);
  files.forEach(f => console.log(`  - ${f.split('/').pop()}`));
  
  try {
    const aggregate = analyzeMultipleScenarios(files);
    
    console.log('\nAggregate Metrics:');
    console.log(`  Total Scenarios: ${aggregate.totalScenarios}`);
    console.log(`  Success Count: ${aggregate.successCount}`);
    console.log(`  Pass Rate: ${(aggregate.passRate * 100).toFixed(1)}%`);
    console.log(`  Median Steps: ${aggregate.medianSteps}`);
    console.log(`  Median Duration: ${aggregate.medianDuration.toFixed(2)}s`);
    console.log(`  Median Entropy: ${aggregate.medianEntropy.toFixed(3)}`);
    console.log(`  Median Backtracks: ${aggregate.medianBacktracks}`);
    console.log(`  Median Optimality: ${(aggregate.medianOptimality * 100).toFixed(1)}%`);
    console.log(`  Total Cost: $${aggregate.totalCost.toFixed(4)}`);
    
    console.log('\n✓ Multiple scenarios test passed\n');
    return true;
  } catch (error) {
    console.error('✗ Multiple scenarios test failed:', error);
    return false;
  }
}

async function main() {
  console.log('Metrics Validation Test');
  console.log('======================\n');
  
  const test1 = await testSingleScenario();
  const test2 = await testMultipleScenarios();
  
  if (test1 && test2) {
    console.log('✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('✗ Some tests failed');
    process.exit(1);
  }
}

main();

