"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const [metrics, setMetrics] = useState({
    pipeline: 0,
    dormant: 0,
    upcomingMeetings: 0,
    tasks: 0,
  });
  const [topSignals, setTopSignals] = useState<any[]>([]);
  const [reviveCompanies, setReviveCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch companies
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name, status, created_at, updated_at")
        .limit(100);

      // Calculate metrics
      const pipeline = companies?.filter((c) => c.status === "prospect" || c.status === "qualified").length || 0;
      const dormant = companies?.filter((c) => {
        const daysSinceUpdate = Math.floor(
          (Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceUpdate > 30;
      }).length || 0;
      const upcomingMeetings = 0; // TODO: Fetch from meetings
      const tasks = 0; // TODO: Fetch from tasks

      setMetrics({ pipeline, dormant, upcomingMeetings, tasks });

      // Mock top signals
      setTopSignals([
        { id: "1", company: "Company A", signal: "ARR grew 50%", date: "2 days ago" },
        { id: "2", company: "Company B", signal: "New round announced", date: "3 days ago" },
      ]);

      // Mock revive companies
      setReviveCompanies([
        { id: "1", company: "Company E", lastTouch: "45 days ago", reason: "No response" },
        { id: "2", company: "Company F", lastTouch: "60 days ago", reason: "Dormant" },
      ]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background min-h-screen" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {/* Header */}
      <div className="bg-background">
        <div className="max-w-7xl mx-auto px-8 pt-6 pb-2">
          <div className="mb-8 pt-0">
            <h1 className="text-2xl font-semibold text-gray-900 leading-6">Home</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-8 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* My Pipeline */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">My Pipeline</h2>
                  <Link href="/pipeline" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    View All
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{metrics.pipeline}</div>
                <p className="text-sm text-gray-600">Companies in pipeline</p>
              </div>

              {/* Dormant Companies */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Dormant Companies</h2>
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                    {metrics.dormant} dormant
                  </span>
                </div>
                {metrics.dormant > 0 ? (
                  <div className="space-y-2">
                    {reviveCompanies.map((company, index) => (
                      <motion.div
                        key={company.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-3 rounded-lg bg-yellow-50 border border-yellow-200"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {company.company}
                            </div>
                            <div className="text-xs text-gray-600">
                              {company.lastTouch} • {company.reason}
                            </div>
                          </div>
                          <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                            Revive
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 text-center py-4">
                    No dormant companies
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Upcoming Meetings */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Meetings</h2>
                {metrics.upcomingMeetings > 0 ? (
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            Meeting with Company A
                          </div>
                          <div className="text-xs text-gray-600">
                            Tomorrow at 2:00 PM
                          </div>
                        </div>
                        <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 text-center py-4">
                    No upcoming meetings
                  </div>
                )}
              </div>

              {/* Tasks */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
                  <Link href="/tasks" className="text-indigo-600 hover:text-indigo-700">
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{metrics.tasks}</div>
                <p className="text-sm text-gray-600">Active tasks</p>
              </div>

              {/* Top Signals */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Top Signals</h2>
                </div>
                {topSignals.length > 0 ? (
                  <div className="space-y-2">
                    {topSignals.map((signal, index) => (
                      <motion.div
                        key={signal.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-3 rounded-lg bg-indigo-50 border border-indigo-100"
                      >
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {signal.company}
                        </div>
                        <div className="text-xs text-gray-600">
                          {signal.signal} • {signal.date}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 text-center py-4">
                    No signals
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
