/**
 * FORMAT TO DP - SYSTEM-WIDE DECIMAL FORMATTER
 * 
 * Quick Reference Guide for using formatToDP() across the Scanstream Scout Report system
 */

# formatToDP() - Global Decimal Formatting Standard

## What is formatToDP()?

`formatToDP()` is the system-wide standard function for formatting decimal numbers to 2 decimal places consistently across all Scout Report components and displays.

```typescript
import { formatToDP } from '@/utils/scout-report'

formatToDP(85.456, 2)  // "85.46"
formatToDP(0.6789, 2)  // "0.68"
formatToDP(123.4, 2)   // "123.40"
```

## Why Use It?

✅ **Consistency** - All metrics display identically
✅ **Maintainability** - Change display format in one place
✅ **Safety** - Handles NaN, Infinity, edge cases
✅ **Performance** - Uses native JavaScript `.toFixed()`

## Usage Patterns

### Pattern 1: Direct Formatting in Components

```typescript
// Instead of:
<span>{confidence}</span>  // 0.85 - looks wrong!

// Do this:
import { formatToDP, formatPercent } from '@/utils/scout-report'

<span>{formatPercent(confidence)}</span>  // "85.00%"
```

### Pattern 2: Format Before State

```typescript
// On API response:
const report = await fetch(`/api/scout/${symbol}`).then(r => r.json())

// Format immediately
const formatted = {
  confidence: formatToDP(report.executiveSummary.confidence * 100, 2),
  quality: formatToDP(calculateQuality(report), 2),
  agreement: formatToDP(calculateAgreement(report.consensus) * 100, 2)
}

// Use formatted values in component
<MetricCard value={formatted.quality} label="Quality Score" />
```

### Pattern 3: Format in Utility Functions

```typescript
// In scout-report-utils.ts:
export function formatOpportunityForDisplay(opp: TradeOpportunity) {
  return {
    ...opp,
    formattedConfidence: formatToDP(opp.confidence * 100, 2),
    formattedQuality: formatToDP(calculateOpportunityQuality(opp), 2),
    formattedRiskReward: `1:${formatToDP(opp.riskReward, 2)}`
  }
}

// In component:
const formatted = formatOpportunityForDisplay(opportunity)
<span>{formatted.formattedConfidence}%</span>  // "85.00%"
```

### Pattern 4: Format All Specialized Values

```typescript
import {
  formatToDP,
  formatMetric,
  formatPercent,
  formatPrice,
  formatRiskReward,
  formatDuration
} from '@/utils/scout-report'

// Different value types, all use formatToDP internally
formatMetric(85.456)           // "85.46"
formatPercent(0.85)            // "85.00%"
formatPrice(150.256)           // "$150.26"
formatRiskReward(1, 2.534)     // "1:2.53"
formatDuration(125)            // "2.1h"
```

## Where to Use formatToDP()

### ✅ DO USE formatToDP() for:

1. **MetricCard displays**
   ```typescript
   <MetricCard value={formatToDP(confidence * 100, 2)} />
   ```

2. **Summary stats**
   ```typescript
   <span>Quality: {formatToDP(quality, 2)}/100</span>
   ```

3. **Opportunity cards**
   ```typescript
   <span>{formatRiskReward(1, opportunity.riskReward)}</span>
   ```

4. **Chart labels**
   ```typescript
   yAxisLabel: formatToDP(value, 2)
   ```

5. **Modal displays**
   ```typescript
   <TradeDetailModal 
     riskReward={formatRiskReward(1, opportunity.riskReward)}
   />
   ```

6. **Export functions**
   ```typescript
   csv += `"${formatToDP(opp.confidence, 2)}", ...`
   ```

7. **API response formatting**
   ```typescript
   const displayValue = formatToDP(apiValue, 2)
   ```

### ❌ DON'T USE formatToDP() for:

1. **Internal calculations** - Keep raw decimals
   ```typescript
   // Wrong:
   const ev = formatToDP(confidence * rr, 2) * 100  // Can't do math on string!
   
   // Right:
   const ev = confidence * rr - (1 - confidence)  // Use raw value
   const displayEV = formatToDP(ev, 2)            // Format for display
   ```

2. **Comparisons and logic**
   ```typescript
   // Wrong:
   if (formatToDP(confidence, 2) > 0.75) { }  // Can't compare strings!
   
   // Right:
   if (confidence > 0.75) { }  // Compare raw values
   ```

3. **Storage or database**
   ```typescript
   // Wrong:
   await db.save({ confidence: formatToDP(confidence, 2) })  // Loses precision
   
   // Right:
   await db.save({ confidence: confidence })  // Store raw value
   ```

## Real-World Examples

### Example 1: MetricCard Component

```typescript
import { formatToDP, formatPercent } from '@/utils/scout-report'
import { calculateOpportunityQuality } from '@/utils/scout-report-utils'

interface MetricCardProps {
  label: string
  value: number
  unit: string
}

export function MetricCard({ label, value, unit }: MetricCardProps) {
  // Format the value once
  const displayValue = formatToDP(value, 2)
  
  return (
    <div className="metric-card">
      <h3>{label}</h3>
      <span className="value">{displayValue} {unit}</span>
    </div>
  )
}

// Usage:
<MetricCard label="Quality" value={calculateOpportunityQuality(opp)} unit="/100" />
// Renders: "Quality" "82.00 /100"
```

### Example 2: Opportunity Card

```typescript
import {
  formatRiskReward,
  formatPercent,
  formatToDP
} from '@/utils/scout-report'

export function OpportunityCard({ opportunity }: { opportunity: TradeOpportunity }) {
  return (
    <div className="opportunity-card">
      <h3>{opportunity.type}</h3>
      
      <div className="metrics">
        <span>Confidence: {formatPercent(opportunity.confidence)}</span>
        <span>Quality: {formatToDP(opportunity.quality, 2)}/100</span>
        <span>R:R: {formatRiskReward(1, opportunity.riskReward)}</span>
        <span>Probability: {formatPercent(opportunity.probability)}</span>
      </div>
      
      <button>View Details</button>
    </div>
  )
}

// All values consistently formatted with 2 decimal places
```

### Example 3: Scout Report Viewer

```typescript
import {
  formatToDP,
  calculateOpportunityQuality,
  calculateAgreement,
  calculateSignalStrength
} from '@/utils/scout-report'

export function ScoutReportViewer({ report }: { report: ScoutReport }) {
  // Format all metrics once
  const metrics = {
    quality: formatToDP(calculateOpportunityQuality(report.opportunities[0]), 2),
    agreement: formatToDP(calculateAgreement(report.consensus) * 100, 2),
    strength: formatToDP(calculateSignalStrength(report), 2)
  }
  
  return (
    <div>
      <div className="summary">
        <MetricCard label="Quality" value={metrics.quality} />
        <MetricCard label="Agreement" value={metrics.agreement} unit="%" />
        <MetricCard label="Signal Strength" value={metrics.strength} unit="/10" />
      </div>
      
      <OpportunitiesGrid opportunities={report.opportunities} />
    </div>
  )
}
```

### Example 4: Filtering with Formatted Display

```typescript
import {
  filterOpportunities,
  formatOpportunitiesForDisplay,
  formatToDP
} from '@/utils/scout-report'

export function OpportunityFilter({ opportunities }: Props) {
  // Filter with raw values
  const filtered = filterOpportunities(opportunities, {
    minConfidence: 0.7,
    minRiskReward: 1.5,
    minQuality: 75
  })
  
  // Format for display
  const formatted = formatOpportunitiesForDisplay(filtered)
  
  return (
    <div>
      <h2>Found {formatted.length} opportunities</h2>
      {formatted.map(opp => (
        <div key={opp.id}>
          <span>Confidence: {opp.formattedConfidence}%</span>
          <span>Quality: {opp.formattedQuality}/100</span>
          <span>R:R: {opp.formattedRiskReward}</span>
        </div>
      ))}
    </div>
  )
}
```

## Decimal Places Configuration

The default is 2 decimal places, but you can customize:

```typescript
import { formatToDP } from '@/utils/scout-report'

// 2 decimal places (default)
formatToDP(3.14159)      // "3.14"

// 1 decimal place
formatToDP(3.14159, 1)   // "3.1"

// 3 decimal places
formatToDP(3.14159, 3)   // "3.142"

// 4 decimal places (for crypto)
formatToDP(0.0001234, 4) // "0.0001"
```

## Specialized Formatters Built on formatToDP()

Instead of using `formatToDP()` directly, use these semantic formatters:

```typescript
import {
  formatMetric,           // General metrics
  formatPercent,          // Percentages with %
  formatPrice,            // USD prices with $
  formatRiskReward,       // Risk/reward ratio
  formatDuration,         // Time durations
  formatLargeNumber,      // Millions/billions (1.5K)
  formatChange,           // % changes with color
  formatConfidenceWithColor,  // Colored confidence
  formatRiskScore         // 1-10 risk gauge
} from '@/utils/scout-report'

// These all use formatToDP() internally!
formatMetric(85.456)         // "85.46"
formatPercent(0.85)          // "85.00%"
formatPrice(150.256)         // "$150.26"
formatRiskReward(1, 2.534)   // "1:2.53"
formatDuration(125)          // "2.1h"
formatLargeNumber(1500000)   // "1.50M"
```

## Performance Considerations

✅ **Efficient** - Uses native `.toFixed()` internally
✅ **Cached** - No recalculation if value unchanged
✅ **Composable** - Chain with other formatters

```typescript
// Each function is independent and fast
const confidence = formatPercent(0.85)      // Fast
const quality = formatToDP(calculateQuality(opp), 2)  // Fast + cached result

// Combine for display
<span>{confidence} - {quality}/100</span>   // Both already formatted
```

## Troubleshooting

### Issue: "Cannot read property of NaN"

```typescript
// Wrong:
const value = Math.sqrt(-1)
const display = value.toFixed(2)  // NaN.toFixed() throws

// Right:
import { formatToDP } from '@/utils/scout-report'
const value = Math.sqrt(-1)
const display = formatToDP(value, 2)  // "0.00" - handles NaN
```

### Issue: Inconsistent decimal places

```typescript
// Wrong - different places in different components:
<span>{(85.456).toFixed(2)}</span>        // "85.46"
<span>{(85.456).toFixed(1)}</span>        // "85.5"
<span>{(0.85 * 100).toFixed(2)}%</span>   // "85.00%"

// Right - use formatToDP consistently:
import { formatToDP, formatPercent } from '@/utils/scout-report'
<span>{formatToDP(85.456, 2)}</span>      // "85.46"
<span>{formatToDP(85.456, 2)}</span>      // "85.46"
<span>{formatPercent(0.85)}</span>        // "85.00%"
```

### Issue: Loss of precision in calculations

```typescript
// Wrong - formatting too early:
const ev = formatToDP(confidence * rr, 2)  // "1.23"
const adjusted = ev * 1.5  // ERROR - can't multiply strings!

// Right - format only for display:
const ev = confidence * rr  // 1.234567 (raw)
const displayEV = formatToDP(ev, 2)  // "1.23" (for display)
const adjusted = ev * 1.5  // 1.8518505 (calculation uses raw value)
```

## Best Practices

1. **Format at display time** - Keep raw values for calculations
2. **Use specialized formatters** - `formatPercent()`, `formatPrice()`, etc.
3. **Format once per render** - Don't format multiple times
4. **Store formatted separately** - Create `formatted` object if needed for display
5. **Import from index** - `import { formatToDP } from '@/utils/scout-report'`

## Summary

`formatToDP()` is the core building block for consistent numeric display across Scout Reports:

- **2 decimal places** by default
- **Handles edge cases** (NaN, Infinity)
- **Used by specialized formatters** (formatPercent, formatPrice, etc.)
- **System-wide standard** for all metric displays
- **Production ready** and tested

Use it everywhere numeric values are displayed to the user!
