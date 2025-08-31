import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { SignalClassifierConfig } from './signal-classifier';

// Loads config from a file (JSON or YAML)
export function loadSignalClassifierConfig(configPath: string): SignalClassifierConfig {
  const ext = path.extname(configPath).toLowerCase();
  const raw = fs.readFileSync(configPath, 'utf8');
  if (ext === '.json') {
    return JSON.parse(raw);
  }
  if (ext === '.yaml' || ext === '.yml') {
    return yaml.load(raw) as SignalClassifierConfig;
  }
  throw new Error('Unsupported config file type');
}
