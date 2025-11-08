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
  const [userFirstName, setUserFirstName] = useState<string>("");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Get user's first name from auth
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Try to get first name from user metadata (Google OAuth provides this)
        const firstName = user.user_metadata?.first_name || 
                         user.user_metadata?.given_name || 
                         user.user_metadata?.name?.split(' ')[0] ||
                         "";
        setUserFirstName(firstName);
      }

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
        <div className="max-w-7xl mx-auto px-8 pt-6 pb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back{userFirstName ? `, ${userFirstName}` : ""}
          </h1>
          <p className="text-gray-600">Overview of your pipeline and key metrics</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-8 pb-6">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white border-b-2 border-indigo-600 rounded-lg p-6">
              <div className="text-2xl font-bold text-gray-900 mb-1">{metrics.pipeline}</div>
              <div className="text-sm text-gray-600">Companies in Pipeline</div>
            </div>
            <div className="bg-white border-b-2 border-gray-200 rounded-lg p-6">
              <div className="text-2xl font-bold text-gray-900 mb-1">{metrics.tasks}</div>
              <div className="text-sm text-gray-600">Active Tasks</div>
            </div>
            <div className="bg-white border-b-2 border-gray-200 rounded-lg p-6">
              <div className="text-2xl font-bold text-gray-900 mb-1">{metrics.upcomingMeetings}</div>
              <div className="text-sm text-gray-600">Upcoming Meetings</div>
            </div>
            <div className="bg-white border-b-2 border-gray-200 rounded-lg p-6">
              <div className="text-2xl font-bold text-gray-900 mb-1">{metrics.dormant}</div>
              <div className="text-sm text-gray-600">Dormant Companies</div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 flex flex-col">
              {/* Top Signals Section */}
              <div className="bg-white rounded-lg border border-gray-200 flex flex-col flex-1 min-h-0">
                <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-indigo-600" />
                      <h2 className="text-lg font-semibold text-gray-900">Top Signals</h2>
                    </div>
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col min-h-0 overflow-auto">
                  {topSignals.length > 0 ? (
                    <div className="space-y-4">
                      {topSignals.map((signal, index) => (
                        <div key={signal.id} className="flex items-start justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                          <div className="flex-1">
                            <div className="text-base font-medium text-gray-900 mb-1">
                              {signal.company}
                            </div>
                            <div className="text-sm text-gray-600">
                              {signal.signal} • {signal.date}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 text-center py-8 flex-1 flex items-center justify-center">
                      No signals available
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6 flex flex-col h-full">
              {/* Quick Actions */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
                </div>
                <div className="p-6 space-y-3">
                  <Link href="/pipeline" className="block w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                    <div className="font-medium text-gray-900">View Pipeline</div>
                    <div className="text-sm text-gray-600 mt-1">Manage your sales pipeline</div>
                  </Link>
                  <Link href="/tasks" className="block w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                    <div className="font-medium text-gray-900">View Tasks</div>
                    <div className="text-sm text-gray-600 mt-1">Check your active tasks</div>
                  </Link>
                  <Link href="/companies" className="block w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                    <div className="font-medium text-gray-900">Browse Companies</div>
                    <div className="text-sm text-gray-600 mt-1">Explore your company database</div>
                  </Link>
                </div>
              </div>

              {/* Upcoming Meetings */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Upcoming Meetings</h2>
                </div>
                <div className="p-6">
                  {metrics.upcomingMeetings > 0 ? (
                    <div className="space-y-4">
                      <div className="pb-4 border-b border-gray-100">
                        <div className="text-base font-medium text-gray-900 mb-1">
                          Meeting with Company A
                        </div>
                        <div className="text-sm text-gray-600">
                          Tomorrow at 2:00 PM
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 text-center py-8">
                      No upcoming meetings
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Dormant Companies Section - Below main grid */}
          {metrics.dormant > 0 && (
            <div className="mt-6 bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Dormant Companies</h2>
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                    {metrics.dormant} dormant
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {reviveCompanies.map((company, index) => (
                    <div key={company.id} className="flex items-center justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                      <div className="flex-1">
                        <div className="text-base font-medium text-gray-900 mb-1">
                          {company.company}
                        </div>
                        <div className="text-sm text-gray-600">
                          {company.lastTouch} • {company.reason}
                        </div>
                      </div>
                      <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium px-4 py-2 hover:bg-indigo-50 rounded-lg transition-colors">
                        Revive
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
