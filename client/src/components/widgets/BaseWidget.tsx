import { ReactNode } from 'react';
import { GripVertical, X } from 'lucide-react';

interface BaseWidgetProps {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
  onRemove?: (id: string) => void;
  className?: string;
}

export default function BaseWidget({
  id,
  title,
  icon: Icon,
  children,
  onRemove,
  className = '',
}: BaseWidgetProps) {
  return (
    <div className={`
      bg-gradient-to-br from-slate-800/40 to-slate-900/40
      backdrop-blur-sm border border-slate-700/50 rounded-xl
      shadow-xl hover:shadow-2xl transition-all duration-300
      group relative overflow-hidden
      ${className}
    `}>
      {/* Widget Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between bg-slate-900/30">
        <div className="flex items-center space-x-2">
          {Icon && (
            <div className="p-1.5 bg-blue-600/20 rounded-lg">
              <Icon className="w-4 h-4 text-blue-400" />
            </div>
          )}
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        
        <div className="flex items-center space-x-1">
          {/* Drag Handle */}
          <button
            className="p-1 text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          
          {/* Remove Button */}
          {onRemove && (
            <button
              onClick={() => onRemove(id)}
              className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove widget"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Widget Content */}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}
