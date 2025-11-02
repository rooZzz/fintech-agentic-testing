export class DebugLogger {
  private enabled: boolean;
  private namespace: string;

  constructor(namespace: string) {
    this.namespace = namespace;
    this.enabled = 
      process.env.DEBUG_ALL === 'true' || 
      process.env[`DEBUG_${namespace.toUpperCase()}`] === 'true';
  }

  log(message: string, data?: any): void {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] [${this.namespace}] ${message}`);
    
    if (data !== undefined) {
      if (typeof data === 'object') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(data);
      }
    }
  }

  table(message: string, data: any[]): void {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] [${this.namespace}] ${message}`);
    
    if (data && data.length > 0) {
      console.table(data);
    } else {
      console.log('(empty)');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}


