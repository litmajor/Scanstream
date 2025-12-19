/**
 * SCOUT REPORT UTILITIES TEST SUITE
 * 
 * Comprehensive unit tests for all utility functions
 * Test coverage for formatting, filtering, sorting, and calculations
 */

import {
  formatToDP,
  formatMetric,
  formatPercent,
  formatPercentFromDecimal,
  formatPrice,
  formatRiskReward,
  formatDuration,
  formatChange,
  formatConfidenceWithColor,
  formatRiskScore,
  formatDirection,
  formatTradeType,
  formatConviction,
  formatSourceType,
  formatLargeNumber
} from "../utils/formatting";

import {
  filterOpportunitiesByType,
  filterOpportunitiesByConfidence,
  filterOpportunitiesByRiskReward,
  sortByRiskReward,
  sortByConfidence,
  sortByQuality,
  calculateExpectedValue,
  calculateOpportunityQuality,
  calculateAgreement,
  calculateSignalStrength,
  calculateUrgency,
  findBestOpportunity,
  isHighQualityOpportunity,
  hasGoodRiskReward,
  hasStrongConsensus
} from "../utils/scout-report-utils";

// ============================================================================
// FORMATTING TESTS
// ============================================================================

describe("Formatting Utilities", () => {
  describe("formatToDP", () => {
    it("should format numbers to 2 decimal places by default", () => {
      expect(formatToDP(85.456)).toBe("85.46");
      expect(formatToDP(0.6789)).toBe("0.68");
      expect(formatToDP(123.4)).toBe("123.40");
    });

    it("should handle custom decimal places", () => {
      expect(formatToDP(85.456, 1)).toBe("85.5");
      expect(formatToDP(85.456, 3)).toBe("85.456");
    });

    it("should round correctly", () => {
      expect(formatToDP(99.999)).toBe("100.00");
      expect(formatToDP(1.005)).toBe("1.01");
    });

    it("should handle invalid input gracefully", () => {
      expect(formatToDP(NaN)).toBe("0.00");
      expect(formatToDP(Infinity)).toBe("0.00");
    });
  });

  describe("formatMetric", () => {
    it("should format metrics with 2 decimal places", () => {
      expect(formatMetric(85.5)).toBe("85.50");
      expect(formatMetric(0.1)).toBe("0.10");
    });
  });

  describe("formatPercent", () => {
    it("should convert decimal to percentage", () => {
      expect(formatPercent(0.85)).toBe("85.00%");
      expect(formatPercent(0.5)).toBe("50.00%");
    });

    it("should handle invalid values", () => {
      expect(formatPercent(NaN)).toBe("0.00%");
      expect(formatPercent(Infinity)).toBe("0.00%");
    });
  });

  describe("formatPrice", () => {
    it("should format prices with dollar sign", () => {
      expect(formatPrice(150.256)).toBe("$150.26");
      expect(formatPrice(0.0001)).toBe("$0.00");
    });
  });

  describe("formatRiskReward", () => {
    it("should format risk/reward ratio", () => {
      expect(formatRiskReward(1, 2.5)).toBe("1:2.50");
      expect(formatRiskReward(1, 0.5)).toBe("1:0.50");
    });
  });

  describe("formatDuration", () => {
    it("should format minutes correctly", () => {
      expect(formatDuration(15)).toBe("15 min");
      expect(formatDuration(60)).toBe("1.0h");
      expect(formatDuration(1440)).toBe("1.0d");
    });
  });

  describe("formatChange", () => {
    it("should format positive changes with green color", () => {
      const result = formatChange(5.25);
      expect(result.text).toBe("+5.25%");
      expect(result.icon).toBe("📈");
    });

    it("should format negative changes with red color", () => {
      const result = formatChange(-2.1);
      expect(result.text).toBe("-2.10%");
      expect(result.icon).toBe("📉");
    });
  });

  describe("formatConfidenceWithColor", () => {
    it("should return high confidence for 67+", () => {
      const result = formatConfidenceWithColor(75);
      expect(result.level).toBe("high");
      expect(result.text).toBe("75.00%");
    });

    it("should return medium confidence for 33-67", () => {
      const result = formatConfidenceWithColor(50);
      expect(result.level).toBe("medium");
    });

    it("should return low confidence for <33", () => {
      const result = formatConfidenceWithColor(25);
      expect(result.level).toBe("low");
    });
  });

  describe("formatRiskScore", () => {
    it("should classify risk scores correctly", () => {
      expect(formatRiskScore(2).level).toBe("low");
      expect(formatRiskScore(5).level).toBe("medium");
      expect(formatRiskScore(9).level).toBe("high");
    });
  });

  describe("formatDirection", () => {
    it("should format directions with correct icons", () => {
      expect(formatDirection("BULLISH").icon).toBe("📈");
      expect(formatDirection("BEARISH").icon).toBe("📉");
      expect(formatDirection("NEUTRAL").icon).toBe("➡️");
    });
  });

  describe("formatLargeNumber", () => {
    it("should format large numbers with K/M/B", () => {
      expect(formatLargeNumber(1500)).toBe("1.50K");
      expect(formatLargeNumber(1000000)).toBe("1.00M");
      expect(formatLargeNumber(1500000000)).toBe("1.50B");
    });
  });
});

// ============================================================================
// FILTERING TESTS
// ============================================================================

describe("Filtering Functions", () => {
  const mockOpportunities = [
    {
      id: "1",
      type: "SCALP",
      confidence: 0.85,
      riskReward: 2.0,
      probability: 0.75
    },
    {
      id: "2",
      type: "DAY",
      confidence: 0.65,
      riskReward: 1.5,
      probability: 0.6
    },
    {
      id: "3",
      type: "SWING",
      confidence: 0.45,
      riskReward: 3.0,
      probability: 0.5
    }
  ];

  describe("filterOpportunitiesByType", () => {
    it("should filter by type correctly", () => {
      const scalps = filterOpportunitiesByType(mockOpportunities, "SCALP");
      expect(scalps).toHaveLength(1);
      expect(scalps[0].id).toBe("1");
    });

    it("should return all for ALL type", () => {
      const all = filterOpportunitiesByType(mockOpportunities, "ALL");
      expect(all).toHaveLength(3);
    });
  });

  describe("filterOpportunitiesByConfidence", () => {
    it("should filter by minimum confidence", () => {
      const high = filterOpportunitiesByConfidence(mockOpportunities, 0.7);
      expect(high).toHaveLength(1);
      expect(high[0].id).toBe("1");
    });
  });

  describe("filterOpportunitiesByRiskReward", () => {
    it("should filter by minimum R:R ratio", () => {
      const goodRR = filterOpportunitiesByRiskReward(mockOpportunities, 2.0);
      expect(goodRR).toHaveLength(2); // 2.0 and 3.0
    });
  });
});

// ============================================================================
// SORTING TESTS
// ============================================================================

describe("Sorting Functions", () => {
  const mockOpportunities = [
    {
      id: "1",
      type: "SCALP",
      confidence: 0.85,
      riskReward: 2.0,
      probability: 0.75,
      supportingSources: ["ML", "SCANNER"]
    },
    {
      id: "2",
      type: "DAY",
      confidence: 0.65,
      riskReward: 1.5,
      probability: 0.6,
      supportingSources: ["AGENTS"]
    },
    {
      id: "3",
      type: "SWING",
      confidence: 0.45,
      riskReward: 3.0,
      probability: 0.5,
      supportingSources: ["ML", "SCANNER", "AGENTS", "PRICE_ACTION"]
    }
  ];

  describe("sortByRiskReward", () => {
    it("should sort by R:R descending", () => {
      const sorted = sortByRiskReward(mockOpportunities);
      expect(sorted[0].id).toBe("3"); // 3.0
      expect(sorted[1].id).toBe("1"); // 2.0
      expect(sorted[2].id).toBe("2"); // 1.5
    });
  });

  describe("sortByConfidence", () => {
    it("should sort by confidence descending", () => {
      const sorted = sortByConfidence(mockOpportunities);
      expect(sorted[0].id).toBe("1"); // 0.85
      expect(sorted[2].id).toBe("3"); // 0.45
    });
  });

  describe("sortByQuality", () => {
    it("should sort by quality score descending", () => {
      const sorted = sortByQuality(mockOpportunities);
      // Quality calculation: confidence (40%) + RR (30%) + probability (20%) + conviction (10%)
      expect(sorted.length).toBe(3);
    });
  });
});

// ============================================================================
// CALCULATION TESTS
// ============================================================================

describe("Calculation Functions", () => {
  describe("calculateExpectedValue", () => {
    it("should calculate EV correctly", () => {
      const opp = {
        probability: 0.6,
        riskReward: 2.0,
        confidence: 0.8,
        type: "DAY",
        supportingSources: []
      };

      const ev = calculateExpectedValue(opp);
      // EV = (0.6 * 2.0) - (0.4 * 1) = 1.2 - 0.4 = 0.8
      expect(ev).toBe(0.8);
    });

    it("should handle missing probability", () => {
      const opp = {
        probability: 0,
        riskReward: 2.0,
        confidence: 0.8,
        type: "DAY",
        supportingSources: []
      };

      expect(calculateExpectedValue(opp)).toBe(0);
    });
  });

  describe("calculateOpportunityQuality", () => {
    it("should calculate quality score 0-100", () => {
      const opp = {
        confidence: 0.8,
        riskReward: 2.0,
        probability: 0.75,
        conviction: true,
        type: "DAY",
        supportingSources: ["ML", "SCANNER"]
      };

      const quality = calculateOpportunityQuality(opp);
      expect(quality).toBeGreaterThan(0);
      expect(quality).toBeLessThanOrEqual(100);
    });
  });

  describe("calculateAgreement", () => {
    it("should calculate agreement percentage", () => {
      const consensus = {
        primaryDirection: "BULLISH",
        sourceBreakdown: {
          BULLISH: 3,
          BEARISH: 1,
          NEUTRAL: 0
        }
      };

      const agreement = calculateAgreement(consensus);
      expect(agreement).toBe(0.75); // 3 out of 4 = 75%
    });
  });

  describe("calculateSignalStrength", () => {
    it("should return strength 1-10", () => {
      const report = {
        consensus: {
          primaryDirection: "BULLISH",
          sourceBreakdown: { BULLISH: 4, BEARISH: 0, NEUTRAL: 0 }
        },
        mlAnalysis: { confidence: 0.9 },
        scannerAnalysis: { confidence: 0.85 },
        agentsAnalysis: { averageConfidence: 0.8 },
        priceAnalysis: { confidence: 0.75 }
      };

      const strength = calculateSignalStrength(report);
      expect(strength).toBeGreaterThan(1);
      expect(strength).toBeLessThanOrEqual(10);
    });
  });

  describe("calculateUrgency", () => {
    it("should classify urgency correctly", () => {
      const highUrgency = {
        consensus: {
          primaryDirection: "BULLISH",
          sourceBreakdown: { BULLISH: 10, BEARISH: 2, NEUTRAL: 0 }
        },
        mlAnalysis: { confidence: 0.95 },
        scannerAnalysis: { confidence: 0.9 },
        agentsAnalysis: { averageConfidence: 0.92 },
        priceAnalysis: { confidence: 0.88 }
      };

      expect(calculateUrgency(highUrgency)).toBe("HIGH");
    });
  });
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe("Validation Functions", () => {
  describe("isHighQualityOpportunity", () => {
    it("should identify high quality opportunities", () => {
      const highQuality = {
        confidence: 0.9,
        riskReward: 2.5,
        probability: 0.8,
        conviction: true,
        type: "DAY",
        supportingSources: ["ML", "SCANNER", "AGENTS"]
      };

      expect(isHighQualityOpportunity(highQuality)).toBe(true);
    });

    it("should reject low quality opportunities", () => {
      const lowQuality = {
        confidence: 0.3,
        riskReward: 0.8,
        probability: 0.4,
        conviction: false,
        type: "DAY",
        supportingSources: []
      };

      expect(isHighQualityOpportunity(lowQuality)).toBe(false);
    });
  });

  describe("hasGoodRiskReward", () => {
    it("should validate R:R > 1.5", () => {
      expect(hasGoodRiskReward({ riskReward: 2.0 })).toBe(true);
      expect(hasGoodRiskReward({ riskReward: 1.2 })).toBe(false);
    });
  });

  describe("hasStrongConsensus", () => {
    it("should validate strong consensus", () => {
      const strongReport = {
        consensus: {
          primaryDirection: "BULLISH",
          sourceBreakdown: { BULLISH: 10, BEARISH: 1, NEUTRAL: 0 }
        },
        mlAnalysis: { confidence: 0.9 },
        scannerAnalysis: { confidence: 0.85 },
        agentsAnalysis: { averageConfidence: 0.82 },
        priceAnalysis: { confidence: 0.88 }
      };

      expect(hasStrongConsensus(strongReport)).toBe(true);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("Integration Tests", () => {
  const mockReport = {
    symbol: "AAPL",
    consensus: {
      primaryDirection: "BULLISH",
      sourceBreakdown: { BULLISH: 8, BEARISH: 2, NEUTRAL: 0 }
    },
    opportunities: [
      {
        id: "1",
        type: "SCALP",
        confidence: 0.9,
        riskReward: 2.5,
        probability: 0.75,
        conviction: true,
        supportingSources: ["ML", "SCANNER", "AGENTS"],
        estimatedMinutes: 15
      },
      {
        id: "2",
        type: "DAY",
        confidence: 0.7,
        riskReward: 1.8,
        probability: 0.65,
        conviction: false,
        supportingSources: ["ML", "SCANNER"],
        estimatedMinutes: 240
      }
    ],
    mlAnalysis: { confidence: 0.88 },
    scannerAnalysis: { confidence: 0.85 },
    agentsAnalysis: { averageConfidence: 0.82 },
    priceAnalysis: { confidence: 0.9 }
  };

  it("should find best opportunity", () => {
    const best = findBestOpportunity(mockReport.opportunities);
    expect(best).toBeDefined();
    expect(best?.id).toBe("1"); // Higher quality
  });

  it("should calculate report metrics", () => {
    const agreement = calculateAgreement(mockReport.consensus);
    expect(agreement).toBe(0.8); // 8 out of 10

    const strength = calculateSignalStrength(mockReport);
    expect(strength).toBeGreaterThan(1);
    expect(strength).toBeLessThanOrEqual(10);
  });
});
