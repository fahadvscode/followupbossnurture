'use client';

interface FunnelStage {
  stage: string;
  value: number;
}

interface FunnelChartProps {
  data: FunnelStage[];
}

const FUNNEL_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#22c55e'];

export function FunnelChart({ data }: FunnelChartProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="space-y-3 py-2">
      {data.map((stage, index) => {
        const widthPct = Math.max((stage.value / maxValue) * 100, 8);
        const prevValue = index > 0 ? data[index - 1].value : stage.value;
        const conversionRate = prevValue > 0 ? ((stage.value / prevValue) * 100).toFixed(1) : '100';

        return (
          <div key={stage.stage}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground">{stage.stage}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{stage.value.toLocaleString()}</span>
                {index > 0 && (
                  <span className="text-xs text-muted">({conversionRate}%)</span>
                )}
              </div>
            </div>
            <div className="w-full h-8 bg-background rounded-md overflow-hidden">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
