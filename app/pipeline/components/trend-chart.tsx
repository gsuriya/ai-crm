"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";

interface TrendChartProps {
  filters: {
    teamMember: string;
    cadence: string;
    channel: string;
    dateRange: string;
  };
}

export function TrendChart({ filters }: TrendChartProps) {
  const [data, setData] = useState<Array<{ date: string; booked: number; attended: number }>>([]);

  useEffect(() => {
    // Mock data - will be replaced with real API call
    const generateMockData = () => {
      const days = 90;
      const result = [];
      const today = new Date();
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        result.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          booked: Math.floor(Math.random() * 10) + 5,
          attended: Math.floor(Math.random() * 8) + 3,
        });
      }
      return result;
    };

    setData(generateMockData());
  }, [filters]);

  return (
    <Card className="rounded-2xl shadow-sm border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            Meetings Booked Over Time
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground mt-1">Last 90 days</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="booked"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Booked"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="attended"
              stroke="#10b981"
              strokeWidth={2}
              name="Attended"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}


