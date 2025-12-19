import fs from 'fs';
import path from 'path';

export class ExecutionStore {
  private filePath: string;

  constructor(fileName = 'data/executions.log') {
    this.filePath = path.resolve(process.cwd(), fileName);
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.filePath)) fs.writeFileSync(this.filePath, '');
  }

  async saveExecution(obj: any) {
    const line = JSON.stringify({ ts: new Date().toISOString(), payload: obj }) + '\n';
    return fs.promises.appendFile(this.filePath, line);
  }

  async readAll(): Promise<any[]> {
    const raw = await fs.promises.readFile(this.filePath, 'utf-8');
    return raw.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  }
}

export default ExecutionStore;
