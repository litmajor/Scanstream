import express from 'express';
import { featureEngineer } from '../services/rpg-agents/FeatureEngineer';

const router = express.Router();

router.get('/features', (req, res) => {
  try {
    const features = featureEngineer.getAllFeatures();
    res.json({ success: true, data: features });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/importance', (req, res) => {
  try {
    const importance = featureEngineer.getFeatureImportance();
    res.json({ success: true, data: importance });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/create', (req, res) => {
  try {
    const { name, sourceFeatures, combineMethod } = req.body;
    const feature = featureEngineer.createFeature(name, sourceFeatures, combineMethod);
    res.json({ success: true, data: feature });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/generate/:agentType', (req, res) => {
  try {
    const { agentType } = req.params;
    const features = featureEngineer.generateFeatureCombinations(agentType);
    res.json({ success: true, data: features, count: features.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/prune', (req, res) => {
  try {
    const pruned = featureEngineer.pruneFeatures();
    res.json({ success: true, prunedFeatures: pruned, count: pruned.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/feature-set', (req, res) => {
  try {
    const { agentId, featureNames } = req.body;
    const featureSet = featureEngineer.createFeatureSet(agentId, featureNames);
    res.json({ success: true, data: featureSet });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/feature-sets', (req, res) => {
  try {
    const sets = featureEngineer.getAllFeatureSets();
    res.json({ success: true, data: sets });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/compare', (req, res) => {
  try {
    const { setIdA, setIdB } = req.body;
    const comparison = featureEngineer.compareFeatureSets(setIdA, setIdB);
    res.json({ success: true, data: comparison });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
