"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { EmptyState } from "./empty-state";
import { TrendingUp } from "lucide-react";

interface FinancialData {
  id: string;
  company_id: string;
  year: number;
  arr?: number;
  gross_retention?: number;
  net_retention?: number;
  gross_margin?: number;
  ebitda?: number;
  created_at: string;
  updated_at: string;
}

interface FinancialChartsProps {
  financials: FinancialData[];
  companyId: string;
}

export function FinancialCharts({ financials, companyId }: FinancialChartsProps) {
  const [activeTab, setActiveTab] = useState("arr");

  if (financials.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No financial data yet"
        description="Add financial data to see charts and trends."
        actionLabel="Add Financials"
        onAction={() => {
          // TODO: Open add financials modal
        }}
      />
    );
  }

  // Sort by year (oldest first for charts)
  const sortedFinancials = [...financials].sort((a, b) => a.year - b.year);

  // Prepare data for charts
  const chartData = sortedFinancials.map((f) => ({
    year: f.year.toString(),
    arr: f.arr || 0,
    grossRetention: f.gross_retention || 0,
    netRetention: f.net_retention || 0,
    grossMargin: f.gross_margin || 0,
    ebitda: f.ebitda || 0,
  }));

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="arr">ARR Growth</TabsTrigger>
        <TabsTrigger value="retention">Retention</TabsTrigger>
        <TabsTrigger value="margins">Margins & EBITDA</TabsTrigger>
      </TabsList>

      <TabsContent value="arr" className="mt-4">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="year"
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
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Area
              type="monotone"
              dataKey="arr"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.2}
              name="ARR"
            />
          </AreaChart>
        </ResponsiveContainer>
      </TabsContent>

      <TabsContent value="retention" className="mt-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="year"
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
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
              formatter={(value: number) => `${value}%`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="grossRetention"
              stroke="#10b981"
              strokeWidth={2}
              name="Gross Retention"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="netRetention"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Net Retention"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </TabsContent>

      <TabsContent value="margins" className="mt-4">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="year"
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
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
              formatter={(value: number) => `${value}%`}
            />
            <Legend />
            <Bar dataKey="grossMargin" fill="#f59e0b" name="Gross Margin" />
            <Bar dataKey="ebitda" fill="#8b5cf6" name="EBITDA" />
          </BarChart>
        </ResponsiveContainer>
      </TabsContent>
    </Tabs>
  );
}


