/**
 * VFMD Field Constructor - TypeScript Port
 * Builds market vector field from price/volume data
 *
 * The field maps price levels (spatial dimension) across time (temporal)
 * with vector components representing velocity and acceleration
 */

import type { MarketTick, VectorField } from './types';

/**
 * Simple Gaussian blur for field smoothing
 */
function gaussianBlur(
  matrix: number[][],
  sigma: number,
  iterations: number = 1
): number[][] {
  if (sigma <= 0) return matrix;

  const height = matrix.length;
  const width = matrix[0].length;
  let result = matrix.map(row => [...row]);

  for (let iter = 0; iter < iterations; iter++) {
    const kernel = createGaussianKernel(sigma);
    const newResult: number[][] = result.map(row => [...row]);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;
        let weight = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const k = kernel[ky + 1][kx + 1];
            sum += result[y + ky][x + kx] * k;
            weight += k;
          }
        }

        newResult[y][x] = sum / weight;
      }
    }

    result = newResult;
  }

  return result;
}

function createGaussianKernel(sigma: number): number[][] {
  // Guard against tiny sigma producing 1×1 kernel → division by zero
  if (sigma < 0.6) {
    return [[1]]; // return identity kernel for very small sigma
  }

  const size = Math.ceil(sigma * 3) * 2 + 1;
  const kernel: number[][] = [];
  const mean = Math.floor(size / 2);
  let sum = 0;

  for (let i = 0; i < size; i++) {
    kernel[i] = [];
    for (let j = 0; j < size; j++) {
      const x = i - mean;
      const y = j - mean;
      const val =
        Math.exp(-(x * x + y * y) / (2 * sigma * sigma)) /
        (2 * Math.PI * sigma * sigma);
      kernel[i][j] = val;
      sum += val;
    }
  }

  // Normalize (sum > 0 guaranteed due to guard above)
  if (sum > 0) {
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        kernel[i][j] /= sum;
      }
    }
  }

  return kernel;
}

/**
 * Construct vector field from price data
 */
export class FieldConstructor {
  private spatialBins: number;
  private temporalWindow: number;
  private smoothingSigma: number;

  constructor(
    spatialBins: number = 50,
    temporalWindow: number = 100,
    smoothingSigma: number = 2.0
  ) {
    this.spatialBins = spatialBins;
    this.temporalWindow = temporalWindow;
    this.smoothingSigma = smoothingSigma;
  }

  /**
   * Build vector field from price series
   * Returns field of shape [spatialBins, temporalWindow, 2]
   */
  constructField(prices: number[]): VectorField {
    if (prices.length < this.temporalWindow) {
      throw new Error(
        `Need at least ${this.temporalWindow} prices, got ${prices.length}`
      );
    }

    // Use most recent window
    const recentPrices = prices.slice(-this.temporalWindow);

    // Normalize prices to [0, 1]
    const priceMin = Math.min(...recentPrices);
    const priceMax = Math.max(...recentPrices);
    let priceRange = priceMax - priceMin;

    if (priceRange === 0) {
      priceRange = 1.0;
    }

    const normalizedPrices = recentPrices.map(p => (p - priceMin) / priceRange);

    // Calculate price velocity (change per bar) — NORMALIZED BY PRICE RANGE
    // Velocities are now in returns-space (% of window range) instead of raw dollar-space
    // This makes them scale-agnostic: BTC and ETH velocities are now comparable
    const priceVelocity: number[] = [];
    for (let i = 1; i < recentPrices.length; i++) {
      priceVelocity.push((recentPrices[i] - recentPrices[i - 1]) / priceRange);
    }
    priceVelocity.push(priceVelocity[priceVelocity.length - 1] || 0);

    // Calculate acceleration (already normalized since velocities are normalized)
    const priceAccel: number[] = [];
    for (let i = 1; i < priceVelocity.length; i++) {
      priceAccel.push(priceVelocity[i] - priceVelocity[i - 1]);
    }
    priceAccel.push(priceAccel[priceAccel.length - 1] || 0);

    // Create 3D field [spatialBins, temporalWindow, 2]
    const field: number[][][] = Array(this.spatialBins)
      .fill(null)
      .map(() =>
        Array(this.temporalWindow)
          .fill(null)
          .map(() => [0, 0])
      );

    // Populate field: for each time point, map price to spatial bin
    for (let t = 0; t < this.temporalWindow; t++) {
      const priceBin = Math.min(
        this.spatialBins - 1,
        Math.max(0, Math.floor(normalizedPrices[t] * (this.spatialBins - 1)))
      );

      // X: price velocity, Y: acceleration
      field[priceBin][t][0] = priceVelocity[t];
      field[priceBin][t][1] = priceAccel[t];
    }

    // Smooth each component separately
    for (let component = 0; component < 2; component++) {
      const slice: number[][] = field.map(spatial => spatial.map(t => t[component]));
      const smoothed = gaussianBlur(slice, this.smoothingSigma, 1);

      for (let s = 0; s < this.spatialBins; s++) {
        for (let t = 0; t < this.temporalWindow; t++) {
          field[s][t][component] = smoothed[s][t];
        }
      }
    }

    return {
      data: field,
      spatialBins: this.spatialBins,
      temporalWindow: this.temporalWindow,
      priceMin,
      priceMax
    };
  }

  /**
   * Get current position of most recent price in the grid
   */
  getCurrentPosition(field: VectorField): [number, number] {
    const lastPrice = field.priceMax; // Approximate
    const normalized =
      (lastPrice - field.priceMin) /
      (field.priceMax - field.priceMin || 1);
    const spatialBin = Math.min(
      field.spatialBins - 1,
      Math.max(0, Math.floor(normalized * (field.spatialBins - 1)))
    );

    return [spatialBin, field.temporalWindow - 1];
  }
}

/**
 * Extract physics quantities from field
 */
export class FieldAnalyzer {
  /**
   * Compute gradient magnitude |∇F|
   * Shows regions of high force concentration
   */
  static computeGradientMagnitude(field: VectorField): number[][] {
    const data = field.data;
    const s = field.spatialBins;
    const t = field.temporalWindow;

    const magnitude: number[][] = Array(s)
      .fill(null)
      .map(() => Array(t).fill(0));

    for (let i = 0; i < s; i++) {
      for (let j = 0; j < t; j++) {
        // Gradient in spatial direction (i)
        const grad_i_x =
          i < s - 1 ? data[i + 1][j][0] - data[i][j][0] : 0;
        const grad_i_y =
          i < s - 1 ? data[i + 1][j][1] - data[i][j][1] : 0;

        // Gradient in temporal direction (j)
        const grad_j_x =
          j < t - 1 ? data[i][j + 1][0] - data[i][j][0] : 0;
        const grad_j_y =
          j < t - 1 ? data[i][j + 1][1] - data[i][j][1] : 0;

        magnitude[i][j] = Math.sqrt(
          grad_i_x * grad_i_x +
            grad_i_y * grad_i_y +
            grad_j_x * grad_j_x +
            grad_j_y * grad_j_y
        );
      }
    }

    return magnitude;
  }

  /**
   * Compute divergence ∇·F
   * Positive = source (accumulation), Negative = sink (distribution)
   */
  static computeDivergence(field: VectorField): number[][] {
    const data = field.data;
    const s = field.spatialBins;
    const t = field.temporalWindow;

    const divergence: number[][] = Array(s)
      .fill(null)
      .map(() => Array(t).fill(0));

    for (let i = 0; i < s; i++) {
      for (let j = 0; j < t; j++) {
        // ∂Fx/∂i (spatial gradient of x-component)
        const div_x =
          i < s - 1 ? data[i + 1][j][0] - data[i][j][0] : 0;

        // ∂Fy/∂j (temporal gradient of y-component)
        const div_y =
          j < t - 1 ? data[i][j + 1][1] - data[i][j][1] : 0;

        divergence[i][j] = div_x + div_y;
      }
    }

    return divergence;
  }

  /**
   * Compute curl (vorticity in 2D)
   * High values = rotational/choppy flow
   */
  static computeCurl(field: VectorField): number[][] {
    const data = field.data;
    const s = field.spatialBins;
    const t = field.temporalWindow;

    const curl: number[][] = Array(s)
      .fill(null)
      .map(() => Array(t).fill(0));

    for (let i = 0; i < s; i++) {
      for (let j = 0; j < t; j++) {
        // ∂Fy/∂i
        const dFy_di =
          i < s - 1 ? data[i + 1][j][1] - data[i][j][1] : 0;

        // ∂Fx/∂j
        const dFx_dj =
          j < t - 1 ? data[i][j + 1][0] - data[i][j][0] : 0;

        curl[i][j] = dFy_di - dFx_dj;
      }
    }

    return curl;
  }

  /**
   * Get vector at specific grid position
   */
  static getLocalVector(
    field: VectorField,
    spatialPos: number,
    temporalPos: number
  ): [number, number] {
    if (
      spatialPos < 0 ||
      spatialPos >= field.spatialBins ||
      temporalPos < 0 ||
      temporalPos >= field.temporalWindow
    ) {
      return [0, 0];
    }

    return field.data[spatialPos][temporalPos] as [number, number];
  }
}
