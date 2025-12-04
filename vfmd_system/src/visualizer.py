"""
VFMD Visualization Tools
Creates plots to validate physics engine
"""

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from matplotlib.colors import Normalize


sns.set_style('darkgrid')


class VFMDVisualizer:
    """Create validation plots"""
    
    @staticmethod
    def plot_field_with_price(field, prices, title="Market Vector Field"):
        """
        Plot vector field alongside price chart
        
        Args:
            field: Vector field array
            prices: Price array used to build field
            title: Plot title
        """
        fig, axes = plt.subplots(2, 1, figsize=(14, 10))
        
        # Top: Price chart
        ax1 = axes[0]
        ax1.plot(prices, 'k-', linewidth=1.5)
        ax1.set_title(f'{title} - Price Action', fontweight='bold')
        ax1.set_ylabel('Price')
        ax1.grid(alpha=0.3)
        
        # Bottom: Vector field
        ax2 = axes[1]
        
        # Create meshgrid
        Y, X = np.meshgrid(
            np.arange(field.shape[1]),
            np.arange(field.shape[0])
        )
        
        # Calculate field magnitude for background
        magnitude = np.linalg.norm(field, axis=2)
        
        # Plot magnitude as heatmap
        im = ax2.imshow(
            magnitude.T,
            origin='lower',
            cmap='viridis',
            alpha=0.6,
            aspect='auto',
            extent=[0, field.shape[0], 0, field.shape[1]]
        )
        plt.colorbar(im, ax=ax2, label='Field Magnitude')
        
        # Plot vectors (downsample for clarity)
        stride = max(field.shape[0] // 15, 1)
        
        ax2.quiver(
            X[::stride, ::stride],
            Y[::stride, ::stride],
            field[::stride, ::stride, 0].T,
            field[::stride, ::stride, 1].T,
            scale=20,
            width=0.003,
            color='white',
            alpha=0.8
        )
        
        ax2.set_title('Vector Field (White arrows = force direction)', fontweight='bold')
        ax2.set_xlabel('Price Space (bins)')
        ax2.set_ylabel('Time (recent → right)')
        
        plt.tight_layout()
        return fig
    
    @staticmethod
    def plot_peg_timeline(peg_timeline, breakout_bar, lookback=20):
        """
        Plot PEG values leading up to a breakout
        
        Args:
            peg_timeline: List of PEG values
            breakout_bar: Index of breakout
            lookback: How many bars before breakout
        """
        fig, ax = plt.subplots(figsize=(12, 6))
        
        bars_before_breakout = list(range(lookback, 0, -1))
        
        ax.plot(bars_before_breakout, peg_timeline, 'b-o', linewidth=2, markersize=6)
        ax.fill_between(bars_before_breakout, peg_timeline, alpha=0.3)
        
        # Mark the peak PEG
        max_peg_idx = np.argmax(peg_timeline)
        max_peg_bar = bars_before_breakout[max_peg_idx]
        
        ax.axvline(x=max_peg_bar, color='r', linestyle='--', 
                   label=f'PEG Peak ({max_peg_bar} bars before breakout)', linewidth=2)
        ax.axvline(x=0, color='g', linestyle='--', label='Breakout', linewidth=2)
        
        ax.set_xlabel('Bars Before Breakout', fontsize=12)
        ax.set_ylabel('PEG Value', fontsize=12)
        ax.set_title('Potential Energy Gradient Leading to Breakout', fontweight='bold', fontsize=14)
        ax.legend()
        ax.grid(alpha=0.3)
        ax.invert_xaxis()  # So time flows left to right
        
        plt.tight_layout()
        return fig
    
    @staticmethod
    def plot_ti_comparison(chop_ti_values, trend_ti_values):
        """
        Compare TI distribution in chop vs trend
        
        Args:
            chop_ti_values: TI values during choppy periods
            trend_ti_values: TI values during trending periods
        """
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))
        
        # Histogram comparison
        ax1 = axes[0]
        ax1.hist(chop_ti_values, bins=20, alpha=0.6, color='red', label='Chop Zones')
        ax1.hist(trend_ti_values, bins=20, alpha=0.6, color='green', label='Trend Zones')
        ax1.axvline(x=2.0, color='black', linestyle='--', linewidth=2, label='TI=2.0 threshold')
        ax1.set_xlabel('Turbulence Index', fontsize=12)
        ax1.set_ylabel('Frequency', fontsize=12)
        ax1.set_title('TI Distribution: Chop vs Trend', fontweight='bold', fontsize=14)
        ax1.legend()
        ax1.grid(alpha=0.3)
        
        # Box plot comparison
        ax2 = axes[1]
        ax2.boxplot([trend_ti_values, chop_ti_values], 
                    labels=['Trend', 'Chop'],
                    patch_artist=True,
                    boxprops=dict(facecolor='lightblue'),
                    medianprops=dict(color='red', linewidth=2))
        ax2.axhline(y=2.0, color='black', linestyle='--', linewidth=2, label='TI=2.0 threshold')
        ax2.set_ylabel('Turbulence Index', fontsize=12)
        ax2.set_title('TI Statistics by Regime', fontweight='bold', fontsize=14)
        ax2.legend()
        ax2.grid(alpha=0.3, axis='y')
        
        plt.tight_layout()
        return fig
    
    @staticmethod
    def plot_validation_dashboard(validation_results):
        """
        Create comprehensive validation dashboard
        
        Args:
            validation_results: Dict with peg_validation, ti_validation, coherence_validation
        """
        fig = plt.figure(figsize=(16, 10))
        gs = fig.add_gridspec(3, 2, hspace=0.3, wspace=0.3)
        
        # PEG validation
        ax1 = fig.add_subplot(gs[0, :])
        peg_results = validation_results['peg']
        success_rate = peg_results['peg_prediction_rate'] * 100
        avg_lead = peg_results['avg_lead_bars']
        
        ax1.text(0.5, 0.7, 'PEG VALIDATION', ha='center', fontsize=20, fontweight='bold')
        ax1.text(0.5, 0.5, f'Prediction Rate: {success_rate:.1f}%', ha='center', fontsize=16)
        ax1.text(0.5, 0.3, f'Avg Lead Time: {avg_lead:.1f} bars', ha='center', fontsize=16)
        status = '✅ PASS' if peg_results['success'] else '❌ FAIL'
        color = 'green' if peg_results['success'] else 'red'
        ax1.text(0.5, 0.1, status, ha='center', fontsize=18, color=color, fontweight='bold')
        ax1.axis('off')
        
        # TI validation
        ax2 = fig.add_subplot(gs[1, 0])
        ti_results = validation_results['ti']
        chop_ti = ti_results['avg_chop_ti']
        trend_ti = ti_results['avg_trend_ti']
        ti_ratio = ti_results['ti_ratio']
        
        ax2.text(0.5, 0.7, 'TI VALIDATION', ha='center', fontsize=16, fontweight='bold')
        ax2.text(0.5, 0.5, f'Chop TI: {chop_ti:.2f}', ha='center', fontsize=14)
        ax2.text(0.5, 0.3, f'Trend TI: {trend_ti:.2f}', ha='center', fontsize=14)
        ax2.text(0.5, 0.1, f'Ratio: {ti_ratio:.2f}x', ha='center', fontsize=14)
        status = '✅ PASS' if ti_results['success'] else '❌ FAIL'
        color = 'green' if ti_results['success'] else 'red'
        ax2.text(0.5, -0.1, status, ha='center', fontsize=16, color=color, fontweight='bold')
        ax2.axis('off')
        
        # Coherence validation
        ax3 = fig.add_subplot(gs[1, 1])
        coh_results = validation_results['coherence']
        trend_coh = coh_results['trend_coherence']
        range_coh = coh_results['range_coherence']
        
        ax3.text(0.5, 0.7, 'COHERENCE VALIDATION', ha='center', fontsize=16, fontweight='bold')
        ax3.text(0.5, 0.5, f'Trend: {trend_coh:.3f}', ha='center', fontsize=14)
        ax3.text(0.5, 0.3, f'Range: {range_coh:.3f}', ha='center', fontsize=14)
        status = '✅ PASS' if coh_results['success'] else '❌ FAIL'
        color = 'green' if coh_results['success'] else 'red'
        ax3.text(0.5, 0.1, status, ha='center', fontsize=16, color=color, fontweight='bold')
        ax3.axis('off')
        
        # Overall status
        ax4 = fig.add_subplot(gs[2, :])
        all_pass = all([
            peg_results['success'],
            ti_results['success'],
            coh_results['success']
        ])
        
        if all_pass:
            ax4.text(0.5, 0.5, '🎉 ALL VALIDATIONS PASSED', 
                    ha='center', fontsize=24, fontweight='bold', color='green')
            ax4.text(0.5, 0.2, 'Physics engine is working correctly. Proceed to Phase 2.',
                    ha='center', fontsize=14)
        else:
            ax4.text(0.5, 0.5, '⚠️ SOME VALIDATIONS FAILED', 
                    ha='center', fontsize=24, fontweight='bold', color='orange')
            ax4.text(0.5, 0.2, 'Adjust field parameters and re-test.',
                    ha='center', fontsize=14)
        
        ax4.axis('off')
        
        plt.tight_layout()
        return fig
    
    @staticmethod
    def plot_sample_breakout_analysis(prices, field, breakout_idx, peg_timeline):
        """
        Detailed analysis of one breakout event
        """
        fig = plt.figure(figsize=(16, 10))
        gs = fig.add_gridspec(3, 2, hspace=0.3, wspace=0.3)
        
        # Price chart with breakout marked
        ax1 = fig.add_subplot(gs[0, :])
        window_start = max(0, breakout_idx - 50)
        window_end = min(len(prices), breakout_idx + 20)
        price_window = prices[window_start:window_end]
        
        ax1.plot(price_window, 'k-', linewidth=2)
        ax1.axvline(x=breakout_idx-window_start, color='g', linestyle='--', linewidth=2, label='Breakout')
        
        # Mark PEG peak
        peg_peak_bar = breakout_idx - window_start - np.argmax(peg_timeline[-15:])
        ax1.axvline(x=peg_peak_bar, color='r', linestyle='--', linewidth=2, label='PEG Peak')
        
        ax1.set_title('Price Action Around Breakout', fontweight='bold', fontsize=14)
        ax1.set_xlabel('Bar Index')
        ax1.set_ylabel('Price')
        ax1.legend()
        ax1.grid(alpha=0.3)
        
        # PEG timeline
        ax2 = fig.add_subplot(gs[1, 0])
        bars = list(range(len(peg_timeline), 0, -1))
        ax2.plot(bars, peg_timeline, 'b-o', linewidth=2)
        ax2.axvline(x=0, color='g', linestyle='--', alpha=0.5)
        ax2.set_title('PEG Leading to Breakout', fontweight='bold')
        ax2.set_xlabel('Bars Before Breakout')
        ax2.set_ylabel('PEG')
        ax2.invert_xaxis()
        ax2.grid(alpha=0.3)
        
        # Vector field
        ax3 = fig.add_subplot(gs[1, 1])
        magnitude = np.linalg.norm(field, axis=2)
        im = ax3.imshow(magnitude.T, origin='lower', cmap='plasma', aspect='auto')
        plt.colorbar(im, ax=ax3, label='Field Strength')
        ax3.set_title('Vector Field Magnitude', fontweight='bold')
        ax3.set_xlabel('Price Space')
        ax3.set_ylabel('Time')
        
        # Divergence map
        from physics_calculator import PhysicsCalculator
        from field_constructor import FieldAnalyzer
        
        analyzer = FieldAnalyzer()
        divergence = analyzer.compute_divergence(field)
        
        ax4 = fig.add_subplot(gs[2, :])
        im = ax4.imshow(divergence.T, origin='lower', cmap='RdBu_r', aspect='auto',
                       vmin=-np.abs(divergence).max(), vmax=np.abs(divergence).max())
        plt.colorbar(im, ax=ax4, label='Divergence')
        ax4.set_title('Flow Divergence (Red=Accumulation, Blue=Distribution)', fontweight='bold')
        ax4.set_xlabel('Price Space')
        ax4.set_ylabel('Time')
        
        plt.tight_layout()
        return fig


if __name__ == "__main__":
    print("Visualization module ready")
    print("Use these functions to validate your physics engine")