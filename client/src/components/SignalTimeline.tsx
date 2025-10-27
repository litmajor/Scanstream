import { TrendingUp, TrendingDown, Activity, Clock } from 'lucide-react';

interface TimelineEvent {
  time: Date;
  type: 'BUY' | 'SELL' | 'HOLD';
  symbol: string;
  price: number;
  change: number;
  confidence: number;
}

interface SignalTimelineProps {
  events: TimelineEvent[];
}

export default function SignalTimeline({ events }: SignalTimelineProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'BUY':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'SELL':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Activity className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'BUY':
        return 'border-green-500 bg-green-900/20';
      case 'SELL':
        return 'border-red-500 bg-red-900/20';
      default:
        return 'border-yellow-500 bg-yellow-900/20';
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Clock className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-bold text-white">Signal Timeline</h3>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-700" />

        {/* Events */}
        <div className="space-y-4">
          {events.map((event, idx) => (
            <div key={idx} className="relative pl-12">
              {/* Timeline dot */}
              <div className={`absolute left-4 w-4 h-4 rounded-full border-2 ${
                event.type === 'BUY' ? 'border-green-500 bg-green-500/20' :
                event.type === 'SELL' ? 'border-red-500 bg-red-500/20' :
                'border-yellow-500 bg-yellow-500/20'
              }`} />

              {/* Event card */}
              <div className={`border-l-4 rounded-r-lg p-4 ${getTypeColor(event.type)}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getTypeIcon(event.type)}
                    <span className="font-mono font-semibold text-white">{event.symbol}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      event.type === 'BUY' ? 'bg-green-500/20 text-green-400' :
                      event.type === 'SELL' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {event.type}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{formatTime(event.time)}</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div>
                    <span className="text-xs text-slate-500">Price</span>
                    <p className="text-sm font-bold text-white">${event.price.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Change</span>
                    <p className={`text-sm font-bold ${event.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {event.change >= 0 ? '+' : ''}{event.change.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Confidence</span>
                    <p className="text-sm font-bold text-blue-400">{(event.confidence * 100).toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
