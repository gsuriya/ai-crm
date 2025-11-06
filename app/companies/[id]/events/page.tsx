"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Bell, RefreshCw, CheckCircle2, ExternalLink, Globe, Linkedin, FileText, TrendingUp } from "lucide-react";

interface CompanyEvent {
  id: string;
  company_id: string;
  event_type: 'apify_website' | 'proxycurl_linkedin' | 'brightdata_social' | 'diffbot_news';
  event_category: 'new_content' | 'employee_change' | 'job_posting' | 'social_post' | 'news_article' | 'funding' | 'other';
  title: string;
  description?: string;
  source_url?: string;
  metadata?: Record<string, any>;
  detected_at: string;
  is_new: boolean;
  created_at: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  apify_website: 'Website',
  brightdata_linkedin: 'LinkedIn',
  brightdata_social: 'Social Media',
  diffbot_news: 'News',
};

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  new_content: 'New Content',
  employee_change: 'Employee Change',
  job_posting: 'Job Posting',
  social_post: 'Social Post',
  news_article: 'News Article',
  funding: 'Funding',
  other: 'Other',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  apify_website: 'bg-blue-500',
  brightdata_linkedin: 'bg-blue-600',
  brightdata_social: 'bg-purple-500',
  diffbot_news: 'bg-green-500',
};

const EVENT_CATEGORY_COLORS: Record<string, string> = {
  new_content: 'bg-blue-100 text-blue-800',
  employee_change: 'bg-yellow-100 text-yellow-800',
  job_posting: 'bg-green-100 text-green-800',
  social_post: 'bg-purple-100 text-purple-800',
  news_article: 'bg-gray-100 text-gray-800',
  funding: 'bg-emerald-100 text-emerald-800',
  other: 'bg-gray-100 text-gray-800',
};

export default function CompanyEventsPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;

  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [checking, setChecking] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [companyId]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('company_events')
        .select('*')
        .eq('company_id', companyId)
        .order('detected_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('event_type', filterType);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [filterType]);

  const handleCheckNow = async () => {
    try {
      setChecking(true);
      const response = await fetch(`/api/monitoring/check-manual?companyId=${companyId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to check for events');
      }

      const result = await response.json();
      
      // Refresh events list
      await fetchEvents();
      
      // Show success message
      alert(`Check completed! Found ${result.eventsFound} events, saved ${result.eventsSaved} new events.`);
    } catch (error: any) {
      console.error('Error checking for events:', error);
      alert(`Error: ${error.message || 'Failed to check for events'}`);
    } finally {
      setChecking(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingRead(true);
      const response = await fetch('/api/monitoring/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyId }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark events as read');
      }

      // Refresh events list
      await fetchEvents();
      
      // Refresh the page to update badge counts
      window.location.reload();
    } catch (error: any) {
      console.error('Error marking events as read:', error);
      alert(`Error: ${error.message || 'Failed to mark events as read'}`);
    } finally {
      setMarkingRead(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'apify_website':
        return Globe;
      case 'proxycurl_linkedin':
        return Linkedin;
      case 'diffbot_news':
        return FileText;
      default:
        return Bell;
    }
  };

  const unreadCount = events.filter(e => e.is_new).length;

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Company Events</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor new content, job postings, news, and more
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                onClick={handleMarkAllAsRead}
                disabled={markingRead}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {markingRead ? 'Marking...' : `Mark All Read (${unreadCount})`}
              </Button>
            )}
            <Button
              onClick={handleCheckNow}
              disabled={checking}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Checking...' : 'Check Now'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex items-center gap-4">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="apify_website">Website</SelectItem>
              <SelectItem value="brightdata_linkedin">LinkedIn</SelectItem>
              <SelectItem value="diffbot_news">News</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">
            {events.length} event{events.length !== 1 ? 's' : ''} found
            {unreadCount > 0 && ` • ${unreadCount} unread`}
          </div>
        </div>

        {/* Events List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No events found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {filterType !== 'all'
                  ? 'No events match your filter. Try selecting a different type.'
                  : 'No events have been detected yet. Click "Check Now" to run a manual check.'}
              </p>
              {filterType === 'all' && (
                <Button onClick={handleCheckNow} disabled={checking}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
                  Check Now
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const EventIcon = getEventIcon(event.event_type);
              return (
                <Card key={event.id} className={event.is_new ? 'border-l-4 border-l-blue-500' : ''}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <EventIcon className="h-4 w-4 text-muted-foreground" />
                          <Badge className={`${EVENT_TYPE_COLORS[event.event_type] || 'bg-gray-500'} text-white border-0`}>
                            {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                          </Badge>
                          <Badge variant="outline" className={EVENT_CATEGORY_COLORS[event.event_category] || ''}>
                            {EVENT_CATEGORY_LABELS[event.event_category] || event.event_category}
                          </Badge>
                          {event.is_new && (
                            <Badge className="bg-blue-500 text-white border-0">New</Badge>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">
                          {event.title}
                        </h3>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {event.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatDate(event.detected_at)}</span>
                          {event.source_url && (
                            <a
                              href={event.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View Source
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

