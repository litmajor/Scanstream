# Physics Theory Backtest Validation Script
# Tests the unified backtest endpoint with physics-aware configurations

$backendUrl = "http://localhost:5000"

# Test 1: Physics-Aware Backtest with Flow Field Integration
Write-Host "=" * 80
Write-Host "TEST 1: Physics-Aware Backtest (Flow Field Theory)" -ForegroundColor Cyan
Write-Host "=" * 80

$body1 = @{
    assets = @("BTC/USDT", "ETH/USDT")
    signalSources = @("scanner", "ml-engine", "rl-agent")
    votingStrategy = "majority"
    startDate = "2024-11-01"
    endDate = "2024-12-20"
    initialCapital = 10000
    slippage = 0.001
    commission = 0.001
    positionSizingMethod = "dynamic"
    riskPerTrade = 0.02
    maxDrawdown = 0.2
    timeframe = "1h"
    autoHealGaps = $true
} | ConvertTo-Json

try {
    $response1 = Invoke-WebRequest `
        -Uri "$backendUrl/api/backtest/unified/run" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body $body1 `
        -ErrorAction Stop

    $result1 = $response1.Content | ConvertFrom-Json
    
    Write-Host "`n✓ Backtest completed successfully" -ForegroundColor Green
    Write-Host "Total Return: $(($result1.results.metrics.totalReturn * 100).ToString('F2'))%" -ForegroundColor Yellow
    Write-Host "Sharpe Ratio: $($result1.results.metrics.sharpeRatio.ToString('F2'))" -ForegroundColor Yellow
    Write-Host "Max Drawdown: $(($result1.results.metrics.maxDrawdown * 100).ToString('F2'))%" -ForegroundColor Yellow
    Write-Host "Win Rate: $(($result1.results.metrics.winRate * 100).ToString('F2'))%" -ForegroundColor Yellow
    Write-Host "Trades Executed: $($result1.results.tradeCount)" -ForegroundColor Yellow
} catch {
    Write-Host "`n✗ Backtest failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Physics Agents Performance
Write-Host "`n" * 2
Write-Host "=" * 80
Write-Host "TEST 2: Physics Agents (VFMD + Flow) Performance" -ForegroundColor Cyan
Write-Host "=" * 80

try {
    $response2 = Invoke-WebRequest `
        -Uri "$backendUrl/api/agents/physics/metrics" `
        -Method GET `
        -ErrorAction Stop

    $physicsMetrics = $response2.Content | ConvertFrom-Json
    
    Write-Host "`n✓ Physics agents metrics retrieved" -ForegroundColor Green
    
    if ($physicsMetrics.agents) {
        foreach ($agent in $physicsMetrics.agents) {
            Write-Host "`nAgent: $($agent.name)" -ForegroundColor Yellow
            Write-Host "  Win Rate: $(($agent.winRate * 100).ToString('F2'))%" 
            Write-Host "  Avg Trade Return: $(($agent.avgTradeReturn * 100).ToString('F2'))%"
            Write-Host "  Sharpe Ratio: $($agent.sharpeRatio.ToString('F2'))"
        }
    }
} catch {
    Write-Host "`n✗ Failed to fetch physics agents metrics: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Capability Measurement
Write-Host "`n" * 2
Write-Host "=" * 80
Write-Host "TEST 3: Capability Measurement (Cluster Impact Analysis)" -ForegroundColor Cyan
Write-Host "=" * 80

$body3 = @{
    assets = @("BTC/USDT")
    startDate = "2024-11-15"
    endDate = "2024-12-15"
    initialCapital = 5000
    timeframe = "1h"
} | ConvertTo-Json

try {
    $response3 = Invoke-WebRequest `
        -Uri "$backendUrl/api/backtest/capability-measurement/run" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body $body3 `
        -ErrorAction Stop

    $capMetrics = $response3.Content | ConvertFrom-Json
    
    Write-Host "`n✓ Capability measurement completed" -ForegroundColor Green
    Write-Host "Impact Score: $($capMetrics.impactScore)" -ForegroundColor Yellow
    Write-Host "Cluster Efficiency: $(($capMetrics.clusterEfficiency * 100).ToString('F2'))%" -ForegroundColor Yellow
} catch {
    Write-Host "`n✗ Capability measurement failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Velocity Profile Analysis
Write-Host "`n" * 2
Write-Host "=" * 80
Write-Host "TEST 4: Velocity Profile Analysis" -ForegroundColor Cyan
Write-Host "=" * 80

try {
    $response4 = Invoke-WebRequest `
        -Uri "$backendUrl/api/backtest/velocity-profile/metrics" `
        -Method GET `
        -ErrorAction Stop

    $velocityMetrics = $response4.Content | ConvertFrom-Json
    
    Write-Host "`n✓ Velocity profile metrics retrieved" -ForegroundColor Green
    if ($velocityMetrics) {
        Write-Host "Velocity Distribution: $(($velocityMetrics.avgVelocity).ToString('F4')) units/sec" -ForegroundColor Yellow
        Write-Host "Position Sizing Impact: $(($velocityMetrics.positionSizingImpact * 100).ToString('F2'))%" -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n✗ Failed to fetch velocity metrics: $($_.Exception.Message)" -ForegroundColor Red
}

# Summary
Write-Host "`n" * 2
Write-Host "=" * 80
Write-Host "PHYSICS THEORY VALIDATION - COMPLETE" -ForegroundColor Cyan
Write-Host "=" * 80
Write-Host "`nAll endpoint tests completed. Check results above for validation." -ForegroundColor Green
Write-Host "Use the metrics to verify your physics theory predictions." -ForegroundColor White
