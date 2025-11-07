'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

interface VotingPowerChartProps {
  data: { name: string; value: number; color: string }[];
}

export function VotingPowerChart({ data }: VotingPowerChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(props: PieLabelRenderProps) => {
            const { name, percent } = props;
            const percentage = typeof percent === 'number' ? percent * 100 : 0;
            const labelName = typeof name === 'string' ? name : String(name ?? '');
            return `${labelName}: ${percentage.toFixed(0)}%`;
          }}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

