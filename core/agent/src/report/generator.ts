import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { generateHTML } from './template.js';
import { ReportData, ReportOptions } from './types.js';
import { AggregateMetrics } from '../metrics/types.js';
import { analyzeMultipleScenarios } from '../metrics/analyzer.js';

export function generateReport(
  aggregate: AggregateMetrics,
  options: ReportOptions
): string {
  const reportData: ReportData = {
    title: options.title || 'Agentic Testing Report',
    generatedAt: new Date(),
    aggregate,
    scenarios: aggregate.scenarios
  };
  
  const html = generateHTML(reportData);
  
  const dir = dirname(options.outputPath);
  mkdirSync(dir, { recursive: true });
  
  writeFileSync(options.outputPath, html, 'utf-8');
  
  return options.outputPath;
}

export function generateReportFromFiles(
  filePaths: string[],
  options: ReportOptions
): string {
  const aggregate = analyzeMultipleScenarios(filePaths);
  return generateReport(aggregate, options);
}

