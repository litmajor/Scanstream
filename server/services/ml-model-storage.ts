
/**
 * ML Model Storage Service
 * 
 * Handles saving and loading trained model weights
 */

import { promises as fs } from 'fs';
import path from 'path';

interface ModelWeights {
  direction: number[];
  price: number[];
  volatility: number[];
  risk: number[];
}

interface ModelMetadata {
  version: string;
  trainedAt: string;
  dataPoints: number;
  accuracy?: number;
}

export class MLModelStorage {
  private static modelsDir = path.join(process.cwd(), 'data', 'ml-models');
  
  /**
   * Save trained model weights to disk
   */
  static async saveWeights(weights: ModelWeights, metadata: ModelMetadata): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(this.modelsDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const weightsPath = path.join(this.modelsDir, `weights-${timestamp}.json`);
      const metadataPath = path.join(this.modelsDir, `metadata-${timestamp}.json`);
      
      await fs.writeFile(weightsPath, JSON.stringify(weights, null, 2));
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      
      // Save as latest
      await fs.writeFile(
        path.join(this.modelsDir, 'weights-latest.json'),
        JSON.stringify(weights, null, 2)
      );
      await fs.writeFile(
        path.join(this.modelsDir, 'metadata-latest.json'),
        JSON.stringify(metadata, null, 2)
      );
      
      console.log('[ML Storage] Weights saved successfully');
    } catch (error) {
      console.error('[ML Storage] Error saving weights:', error);
      throw error;
    }
  }
  
  /**
   * Load latest trained model weights
   */
  static async loadLatestWeights(): Promise<{weights: ModelWeights, metadata: ModelMetadata} | null> {
    try {
      const weightsPath = path.join(this.modelsDir, 'weights-latest.json');
      const metadataPath = path.join(this.modelsDir, 'metadata-latest.json');
      
      const weightsData = await fs.readFile(weightsPath, 'utf-8');
      const metadataData = await fs.readFile(metadataPath, 'utf-8');
      
      const weights = JSON.parse(weightsData) as ModelWeights;
      const metadata = JSON.parse(metadataData) as ModelMetadata;
      
      console.log('[ML Storage] Loaded weights from:', metadata.trainedAt);
      return { weights, metadata };
    } catch (error) {
      console.log('[ML Storage] No saved weights found, will use baseline');
      return null;
    }
  }
  
  /**
   * List all saved models
   */
  static async listModels(): Promise<ModelMetadata[]> {
    try {
      await fs.mkdir(this.modelsDir, { recursive: true });
      const files = await fs.readdir(this.modelsDir);
      const metadataFiles = files.filter(f => f.startsWith('metadata-') && f !== 'metadata-latest.json');
      
      const models: ModelMetadata[] = [];
      for (const file of metadataFiles) {
        const data = await fs.readFile(path.join(this.modelsDir, file), 'utf-8');
        models.push(JSON.parse(data));
      }
      
      return models.sort((a, b) => 
        new Date(b.trainedAt).getTime() - new Date(a.trainedAt).getTime()
      );
    } catch (error) {
      console.error('[ML Storage] Error listing models:', error);
      return [];
    }
  }
}
