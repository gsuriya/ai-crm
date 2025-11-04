"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Calendar,
  CheckSquare,
  TrendingUp,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Clock,
  Users,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const [metrics, setMetrics] = useState({
    pipeline: 0,
    overdueSLAs: 0,
    dormant: 0,
    upcomingMeetings: 0,
    tasks: 0,
  });
  const [topSignals, setTopSignals] = useState<any[]>([]);
  const [newLookalikes, setNewLookalikes] = useState<any[]>([]);
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
      const overdueSLAs = 0; // TODO: Calculate from tasks/deals
      const dormant = companies?.filter((c) => {
        const daysSinceUpdate = Math.floor(
          (Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceUpdate > 30;
      }).length || 0;
      const upcomingMeetings = 0; // TODO: Fetch from meetings
      const tasks = 0; // TODO: Fetch from tasks

      setMetrics({ pipeline, overdueSLAs, dormant, upcomingMeetings, tasks });

      // Mock top signals
      setTopSignals([
        { id: "1", company: "Company A", signal: "ARR grew 50%", date: "2 days ago" },
        { id: "2", company: "Company B", signal: "New round announced", date: "3 days ago" },
      ]);

      // Mock new lookalikes
      setNewLookalikes([
        { id: "1", company: "Company C", similarity: 85, reason: "Similar GTM" },
        { id: "2", company: "Company D", similarity: 78, reason: "Same sector" },
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
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Home</h1>
          <p className="text-sm text-muted-foreground mt-1">
            My Pipeline at a glance, Overdue SLAs, Dormant companies, Upcoming meetings, Tasks
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* My Pipeline */}
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-foreground">
                    My Pipeline
                  </CardTitle>
                  <Link href="/pipeline">
                    <Button variant="ghost" size="sm">
                      <ArrowRight className="h-4 w-4 mr-2" />
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground mb-2">{metrics.pipeline}</div>
                <p className="text-sm text-muted-foreground">Companies in pipeline</p>
              </CardContent>
            </Card>

            {/* Overdue SLAs */}
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Overdue SLAs
                  </CardTitle>
                  <Badge variant="destructive" className="text-xs">
                    {metrics.overdueSLAs} overdue
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {metrics.overdueSLAs > 0 ? (
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                          Task overdue by 5 days
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No overdue SLAs
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dormant Companies */}
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Dormant Companies
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {metrics.dormant} dormant
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
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
                            <div className="text-sm font-medium text-foreground">
                              {company.company}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {company.lastTouch} • {company.reason}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            Revive
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No dormant companies
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Upcoming Meetings */}
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-foreground">
                  Upcoming Meetings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.upcomingMeetings > 0 ? (
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            Meeting with Company A
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Tomorrow at 2:00 PM
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No upcoming meetings
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tasks */}
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Tasks
                  </CardTitle>
                  <Link href="/tasks">
                    <Button variant="ghost" size="sm">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground mb-2">{metrics.tasks}</div>
                <p className="text-sm text-muted-foreground">Active tasks</p>
              </CardContent>
            </Card>

            {/* Top Signals */}
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <CardTitle className="text-lg font-semibold text-foreground">
                    Top Signals
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {topSignals.length > 0 ? (
                  <div className="space-y-2">
                    {topSignals.map((signal, index) => (
                      <motion.div
                        key={signal.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-3 rounded-lg bg-accent/50 border border-border"
                      >
                        <div className="text-sm font-medium text-foreground mb-1">
                          {signal.company}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {signal.signal} • {signal.date}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No signals
                  </div>
                )}
              </CardContent>
            </Card>

            {/* New Lookalikes */}
            <Card className="rounded-2xl shadow-sm border border-border p-5">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <CardTitle className="text-lg font-semibold text-foreground">
                    New Lookalikes
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {newLookalikes.length > 0 ? (
                  <div className="space-y-2">
                    {newLookalikes.map((lookalike, index) => (
                      <motion.div
                        key={lookalike.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-3 rounded-lg bg-accent/50 border border-border"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-sm font-medium text-foreground">
                            {lookalike.company}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {lookalike.similarity}% match
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {lookalike.reason}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No new lookalikes
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
