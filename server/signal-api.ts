import express from 'express';
import { SignalClassifier } from './signal-classifier';
import { loadSignalClassifierConfig } from './config-loader';

const app = express();
console.log('Registering USE express.json()');
app.use(express.json());

// Load config once at startup (YAML or JSON)
const configPath = process.env.SIGNAL_CONFIG_PATH || './config/signal-config.yaml';
let config = loadSignalClassifierConfig(configPath);

// Endpoint to reload config (optional)
console.log('Registering POST /api/signal-config/reload');
app.post('/api/signal-config/reload', (req, res) => {
  try {
    config = loadSignalClassifierConfig(configPath);
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Endpoint to classify momentum signal
console.log('Registering POST /api/classify/momentum');
app.post('/api/classify/momentum', (req, res) => {
  const { momentumShort, momentumLong, rsi, macd, additionalIndicators } = req.body;
  try {
    const label = SignalClassifier.classifyMomentumSignal(
      momentumShort, momentumLong, rsi, macd, config, additionalIndicators || {}
    );
    res.json({ label });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Endpoint to classify regime state
console.log('Registering POST /api/classify/state');
app.post('/api/classify/state', (req, res) => {
  const { mom1d, mom7d, mom30d, rsi, macd, bbPos } = req.body;
  try {
    const label = SignalClassifier.classifyState(
      mom1d, mom7d, mom30d, rsi, macd, bbPos, config, undefined, undefined
    );
    res.json({ label });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Endpoint to classify legacy label
console.log('Registering POST /api/classify/legacy');
app.post('/api/classify/legacy', (req, res) => {
  const { mom7d, mom30d, rsi, macd, bbPosition } = req.body;
  try {
    const label = SignalClassifier.classifyLegacy(
      mom7d, mom30d, rsi, macd, bbPosition, config, undefined, undefined
    );
    res.json({ label });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`SignalClassifier API running on port ${port}`);
});
