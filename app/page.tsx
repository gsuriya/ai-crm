"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  Users, 
  Mail, 
  MessageCircle, 
  TrendingUp, 
  ArrowUpRight, 
  Sparkles,
  Send,
  Clock,
  CheckCircle2,
  Building2,
  Zap
} from "lucide-react";

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const [metrics, setMetrics] = useState({
    totalPeople: 0,
    emailsSent: 0,
    responses: 0,
    activeSequences: 0,
    completedSequences: 0,
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

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const firstName = user.user_metadata?.first_name || 
                         user.user_metadata?.given_name || 
                         user.user_metadata?.name?.split(' ')[0] ||
                         "";
        setUserFirstName(firstName);
      }

      const { count: totalPeopleCount } = await supabase
        .from("contacts")
        .select("*", { count: 'exact', head: true });

      const { data: people } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, current_company, job_title, created_at, email")
        .order("created_at", { ascending: false })
        .limit(5);

      const { count: emailsSentCount } = await supabase
        .from("email_logs")
        .select("*", { count: 'exact', head: true })
        .eq("direction", "sent");

      const { data: executions } = await supabase
        .from("cadence_executions")
        .select("id, status, metadata");

      const responsesCount = executions?.filter(
        (exec: any) => exec.metadata?.paused_reason === 'email_reply_received'
      ).length || 0;

      const activeCount = executions?.filter(
        (exec: any) => exec.status === 'active'
      ).length || 0;

      const completedCount = executions?.filter(
        (exec: any) => exec.status === 'completed'
      ).length || 0;

      setMetrics({ 
        totalPeople: totalPeopleCount || 0, 
        emailsSent: emailsSentCount || 0, 
        responses: responsesCount,
        activeSequences: activeCount,
        completedSequences: completedCount,
      });
      setRecentPeople(people || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const responseRate = metrics.emailsSent > 0 
    ? ((metrics.responses / metrics.emailsSent) * 100).toFixed(1) 
    : '0';

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase() || '?';
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-violet-500',
      'bg-sky-500',
      'bg-emerald-500',
      'bg-amber-500',
      'bg-rose-500',
      'bg-indigo-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-white">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-violet-200 border-t-violet-600 animate-spin" />
          </div>
          <p className="text-slate-500 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
      <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span>Good {getTimeOfDay()}</span>
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            Welcome back{userFirstName ? `, ${userFirstName}` : ''}
          </h1>
          <p className="text-slate-500 mt-1">
            Here&apos;s what&apos;s happening with your outreach
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
          {/* Total Contacts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="stat-card bg-white border border-slate-100 rounded-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-violet-600" />
              </div>
              <Link href="/people" className="text-slate-400 hover:text-violet-600 transition-colors">
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
            <p className="text-3xl font-semibold text-slate-900 tracking-tight">{metrics.totalPeople}</p>
            <p className="text-sm text-slate-500 mt-1">Total Contacts</p>
          </motion.div>

          {/* Emails Sent */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="stat-card bg-white border border-slate-100 rounded-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
                <Send className="w-5 h-5 text-sky-600" />
              </div>
            </div>
            <p className="text-3xl font-semibold text-slate-900 tracking-tight">{metrics.emailsSent}</p>
            <p className="text-sm text-slate-500 mt-1">Emails Sent</p>
          </motion.div>

          {/* Responses */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="stat-card bg-white border border-slate-100 rounded-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
              </div>
              {metrics.responses > 0 && (
                <Link href="/outreach" className="text-slate-400 hover:text-emerald-600 transition-colors">
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              )}
            </div>
            <p className="text-3xl font-semibold text-slate-900 tracking-tight">{metrics.responses}</p>
            <p className="text-sm text-slate-500 mt-1">Responses</p>
          </motion.div>

          {/* Response Rate */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="stat-card bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl text-white"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-3xl font-semibold tracking-tight">{responseRate}%</p>
            <p className="text-sm text-violet-200 mt-1">Response Rate</p>
          </motion.div>
          </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Contacts - Takes 2 columns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Recent Contacts</h2>
                <p className="text-sm text-slate-500">People you&apos;ve added recently</p>
              </div>
              <Link 
                href="/people" 
                className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
              >
                View all
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            
                {recentPeople.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recentPeople.map((person, index) => (
                  <Link key={person.id} href={`/people/${person.id}`}>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.35 + index * 0.05 }}
                      className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <div className={`w-11 h-11 rounded-full ${getAvatarColor(person.first_name || '')} flex items-center justify-center text-white font-medium text-sm shadow-sm`}>
                        {getInitials(person.first_name, person.last_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 group-hover:text-violet-600 transition-colors truncate">
                              {person.first_name} {person.last_name}
                        </p>
                        <p className="text-sm text-slate-500 truncate">
                          {person.job_title && person.current_company 
                            ? `${person.job_title} at ${person.current_company}`
                            : person.current_company || person.job_title || 'No company info'}
                        </p>
                            </div>
                      {person.email && (
                        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                          <Mail className="w-3 h-3" />
                          <span className="truncate max-w-[120px]">{person.email}</span>
                        </div>
                      )}
                      <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition-colors flex-shrink-0" />
                    </motion.div>
                      </Link>
                    ))}
                  </div>
                ) : (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-500 mb-1">No contacts yet</p>
                <p className="text-sm text-slate-400">Use the Chrome extension to add contacts from LinkedIn</p>
                  </div>
                )}
          </motion.div>

          {/* Quick Stats Sidebar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            {/* Active Sequences */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-slate-900">{metrics.activeSequences}</p>
                  <p className="text-xs text-slate-500">Active Sequences</p>
                </div>
              </div>
              <Link 
                href="/outreach" 
                className="block w-full py-2.5 px-4 text-center text-sm font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors"
              >
                View Outreach
              </Link>
            </div>

            {/* Completed */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-slate-900">{metrics.completedSequences}</p>
                  <p className="text-xs text-slate-500">Completed</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white">
              <h3 className="font-medium mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link 
                  href="/cadences" 
                  className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-sm"
                >
                  <Clock className="w-4 h-4 text-violet-300" />
                  <span>Create New Cadence</span>
                </Link>
                <Link 
                  href="/companies" 
                  className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-sm"
                >
                  <Building2 className="w-4 h-4 text-emerald-300" />
                  <span>Browse Companies</span>
                </Link>
            </div>
          </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
