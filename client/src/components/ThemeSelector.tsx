import { useState } from 'react';
import { Palette, Moon, Sun, Monitor, Layers, Palette as PaletteIcon, Settings, X } from 'lucide-react';
import { useTheme, ThemePreset } from '../contexts/ThemeContext';

export default function ThemeSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const { preset, setPreset, fontSize, setFontSize, opacity, setOpacity, highContrast, setHighContrast } = useTheme();

  const presets: { id: ThemePreset; name: string; icon: any; preview: string }[] = [
    { id: 'dark', name: 'Dark', icon: Moon, preview: 'bg-slate-900' },
    { id: 'light', name: 'Light', icon: Sun, preview: 'bg-white' },
    { id: 'oled', name: 'OLED', icon: Monitor, preview: 'bg-black' },
    { id: 'cyberpunk', name: 'Cyberpunk', icon: Layers, preview: 'bg-purple-950' },
    { id: 'forest', name: 'Forest', icon: PaletteIcon, preview: 'bg-green-950' },
    { id: 'ocean', name: 'Ocean', icon: PaletteIcon, preview: 'bg-blue-950' },
    { id: 'sunset', name: 'Sunset', icon: PaletteIcon, preview: 'bg-orange-950' },
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        title="Theme Settings"
        aria-label="Open theme settings"
      >
        <Palette className="w-5 h-5 text-slate-400" />
        <span className="sr-only">Theme Settings</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Theme Settings</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                title="Close theme settings"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Theme Presets */}
                             <div>
                 <h3 className="text-sm font-semibold text-slate-300 mb-4">Theme Presets</h3>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                   {presets.map((p) => {
                     const Icon = p.icon;
                     const isActive = preset === p.id;
                     return (
                       <button
                         key={p.id}
                         onClick={() => {
                           console.log(`Changing theme to: ${p.id}`);
                           setPreset(p.id);
                           // Force a re-render by updating the theme immediately
                           setTimeout(() => {
                             document.documentElement.setAttribute('data-theme', p.id);
                           }, 100);
                         }}
                         className={`p-4 rounded-lg border-2 transition-all hover:scale-105 ${
                           isActive
                             ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/20'
                             : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'
                         }`}
                         title={`Switch to ${p.name} theme`}
                       >
                         <div className={`w-full h-16 rounded mb-2 ${p.preview} flex items-center justify-center relative overflow-hidden`}>
                           <Icon className={`w-6 h-6 ${isActive ? 'text-blue-400' : 'text-slate-500'} transition-colors`} />
                           {isActive && (
                             <div className="absolute inset-0 bg-blue-500/10 animate-pulse" />
                           )}
                         </div>
                         <span className={`text-sm font-medium transition-colors ${isActive ? 'text-blue-400' : 'text-slate-300'}`}>
                           {p.name}
                         </span>
                         {isActive && (
                           <div className="flex items-center justify-center mt-1">
                             <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                           </div>
                         )}
                       </button>
                     );
                   })}
                 </div>
               </div>

              {/* Font Size */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Font Size</h3>
                <div className="flex gap-3">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setFontSize(size)}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                        fontSize === size
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="capitalize font-medium">{size}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Opacity */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-300">Widget Opacity</h3>
                  <span className="text-sm text-slate-400">{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  title="Adjust widget opacity"
                  aria-label="Widget opacity"
                />
              </div>

              {/* High Contrast */}
              <div>
                <label className="flex items-center justify-between p-4 rounded-lg border border-slate-700 hover:border-slate-600 cursor-pointer">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300">High Contrast Mode</h3>
                    <p className="text-xs text-slate-400">Increase contrast for better accessibility</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={highContrast}
                    onChange={(e) => setHighContrast(e.target.checked)}
                    className="w-5 h-5 rounded accent-blue-500"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
