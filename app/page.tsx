"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { motion } from "framer-motion";
import { Users, Mail, TrendingUp } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const [metrics, setMetrics] = useState({
    totalPeople: 0,
    emailsSent: 0,
    responses: 0,
  });
  const [recentPeople, setRecentPeople] = useState<any[]>([]);
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

      // Fetch people
      const { data: people } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, current_company, job_title, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      // Fetch email logs
      const { data: emails } = await supabase
        .from("email_logs")
        .select("id, direction")
        .limit(1000);

      // Calculate metrics
      const totalPeople = people?.length || 0;
      const emailsSent = emails?.filter((e) => e.direction === "sent").length || 0;
      const responses = emails?.filter((e) => e.direction === "received").length || 0;

      setMetrics({ totalPeople, emailsSent, responses });
      setRecentPeople(people || []);
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
          <p className="text-gray-600">Your cold email outreach dashboard</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-8 pb-6">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border-b-2 border-indigo-600 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <div className="text-sm text-gray-600">Total People</div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{metrics.totalPeople}</div>
            </div>
            <div className="bg-white border-b-2 border-blue-500 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="h-5 w-5 text-blue-500" />
                <div className="text-sm text-gray-600">Emails Sent</div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{metrics.emailsSent}</div>
            </div>
            <div className="bg-white border-b-2 border-green-500 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <div className="text-sm text-gray-600">Responses</div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{metrics.responses}</div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Recent People */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Recently Added</h2>
                    <Link href="/people" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                      View all
                    </Link>
                  </div>
                </div>
                <div className="p-6">
                  {recentPeople.length > 0 ? (
                    <div className="space-y-4">
                      {recentPeople.map((person) => (
                        <Link key={person.id} href={`/people/${person.id}`}>
                          <div className="flex items-center justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0 hover:bg-gray-50 -mx-2 px-2 py-2 rounded transition-colors">
                            <div className="flex-1">
                              <div className="text-base font-medium text-gray-900 mb-1">
                                {person.first_name} {person.last_name}
                              </div>
                              {person.job_title && person.current_company && (
                                <div className="text-sm text-gray-600">
                                  {person.job_title} at {person.current_company}
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 text-center py-8">
                      No people added yet. <Link href="/people" className="text-indigo-600 hover:text-indigo-700">Add your first contact</Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Quick Actions */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
                </div>
                <div className="p-6 space-y-3">
                  <Link href="/people" className="block w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                    <div className="font-medium text-gray-900">Browse People</div>
                    <div className="text-sm text-gray-600 mt-1">View all contacts</div>
                  </Link>
                  <Link href="/outreach" className="block w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                    <div className="font-medium text-gray-900">Outreach</div>
                    <div className="text-sm text-gray-600 mt-1">Manage campaigns</div>
                  </Link>
                  <Link href="/cadences" className="block w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200">
                    <div className="font-medium text-gray-900">Cadences</div>
                    <div className="text-sm text-gray-600 mt-1">Create sequences</div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
