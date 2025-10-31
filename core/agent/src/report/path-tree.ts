import { PathNode } from './types.js';
import { StepEntry } from '../metrics/types.js';

export function buildPathTree(steps: StepEntry[]): PathNode | null {
  if (steps.length === 0) return null;
  
  const root: PathNode = {
    url: steps[0].observation.url,
    step: 0,
    children: [],
    backtrack: false
  };
  
  const urlToNode = new Map<string, PathNode>();
  urlToNode.set(root.url, root);
  
  let currentNode = root;
  
  for (let i = 1; i < steps.length; i++) {
    const step = steps[i];
    const url = step.observation.url;
    
    const existingNode = urlToNode.get(url);
    if (existingNode) {
      currentNode = existingNode;
      existingNode.backtrack = true;
    } else {
      const newNode: PathNode = {
        url,
        step: step.step,
        children: [],
        backtrack: false
      };
      currentNode.children.push(newNode);
      urlToNode.set(url, newNode);
      currentNode = newNode;
    }
  }
  
  return root;
}

export function renderPathTree(node: PathNode | null, indent: string = ''): string {
  if (!node) return '';
  
  const lines: string[] = [];
  const marker = node.backtrack ? '↩' : '→';
  lines.push(`${indent}${marker} Step ${node.step}: ${node.url}`);
  
  for (const child of node.children) {
    lines.push(renderPathTree(child, indent + '  '));
  }
  
  return lines.join('\n');
}

export function getPathDepth(node: PathNode | null): number {
  if (!node || node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(getPathDepth));
}

export function getPathLength(node: PathNode | null): number {
  if (!node) return 0;
  let total = 1;
  for (const child of node.children) {
    total += getPathLength(child);
  }
  return total;
}

