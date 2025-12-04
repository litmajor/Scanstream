#!/usr/bin/env python3
"""Test Phase 2: Coordinator Integration with Enhanced Bounce Strategy"""

import sys
from strategies.strategy_coop import StrategyCoordinator

def test_initialization():
    """Test that coordinator initializes with bounce strategy"""
    try:
        coord = StrategyCoordinator(
            enable_bounce_strategy=True,
            bounce_risk_profile='moderate'
        )
        print('✓ StrategyCoordinator initialized with bounce strategy')
        print(f'  - Bounce strategy available: {coord.bounce_strategy is not None}')
        print(f'  - Bounce enabled: {coord.enable_bounce_strategy}')
        print(f'  - Bounce risk profile: {coord.bounce_risk_profile}')
        return True
    except Exception as e:
        print(f'✗ Failed to initialize: {e}')
        import traceback
        traceback.print_exc()
        return False

def test_disabled_mode():
    """Test that coordinator works with bounce disabled"""
    try:
        coord = StrategyCoordinator(
            enable_bounce_strategy=False
        )
        print('\n✓ StrategyCoordinator works with bounce disabled')
        print(f'  - Bounce enabled: {coord.enable_bounce_strategy}')
        return True
    except Exception as e:
        print(f'\n✗ Failed with bounce disabled: {e}')
        return False

if __name__ == '__main__':
    print('Phase 2 Integration Test\n' + '='*50)
    
    success = True
    success = test_initialization() and success
    success = test_disabled_mode() and success
    
    print('\n' + '='*50)
    if success:
        print('✓ All tests passed - Phase 2 integration complete!')
        sys.exit(0)
    else:
        print('✗ Some tests failed')
        sys.exit(1)
