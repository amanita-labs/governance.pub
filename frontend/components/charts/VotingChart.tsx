'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface VotingChartProps {
  data: {
    name: string;
    yes: number;
    no: number;
    abstain: number;
  }[];
}

export function VotingChart({ data }: VotingChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No voting data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="yes" stackId="a" fill="#10b981" name="Yes" />
        <Bar dataKey="no" stackId="a" fill="#ef4444" name="No" />
        <Bar dataKey="abstain" stackId="a" fill="#f59e0b" name="Abstain" />
      </BarChart>
    </ResponsiveContainer>
  );
}

