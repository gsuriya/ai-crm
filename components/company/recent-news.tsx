"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Newspaper, ExternalLink, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

interface RecentNewsProps {
  companyId: string;
}

interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  url?: string;
  summary?: string;
}

export function RecentNews({ companyId }: RecentNewsProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentNews();
  }, [companyId]);

  const fetchRecentNews = async () => {
    try {
      setLoading(true);
      
      // Try to fetch from company_content table (news articles)
      const { data: contentData } = await supabase
        .from("company_content")
        .select("*")
        .eq("company_id", companyId)
        .eq("content_type", "other")
        .order("created_at", { ascending: false })
        .limit(5);

      if (contentData && contentData.length > 0) {
        const newsItems: NewsItem[] = contentData.map((item, index) => ({
          id: item.id,
          title: item.metadata?.title || `News Item ${index + 1}`,
          source: item.source || "Unknown Source",
          publishedAt: item.created_at,
          url: item.metadata?.url,
          summary: item.content?.substring(0, 150),
        }));
        setNews(newsItems);
      } else {
        // Mock data for now - in production, integrate with news API
        setNews([
          {
            id: "1",
            title: "Company announces Series B funding round",
            source: "TechCrunch",
            publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            url: "https://example.com/news1",
            summary: "The company has successfully closed a $50M Series B funding round led by prominent VCs...",
          },
          {
            id: "2",
            title: "New product launch targets enterprise market",
            source: "Business Insider",
            publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            url: "https://example.com/news2",
            summary: "The company unveiled its latest enterprise solution designed to help large organizations...",
          },
          {
            id: "3",
            title: "Partnership with major tech company announced",
            source: "Forbes",
            publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            url: "https://example.com/news3",
            summary: "Strategic partnership will enable both companies to expand their market reach...",
          },
        ]);
      }
    } catch (error) {
      console.error("Error fetching recent news:", error);
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  if (loading) {
    return (
      <Card className="rounded-2xl shadow-sm border border-border p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  if (news.length === 0) {
    return (
      <Card className="rounded-2xl shadow-sm border border-border p-5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg font-semibold text-foreground">
              Recent News
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No recent news found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm border border-border p-5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          <CardTitle className="text-lg font-semibold text-foreground">
            Recent News
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Latest updates & announcements
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {news.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-3 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  {item.title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span>{item.source}</span>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(item.publishedAt)}
                  </div>
                </div>
                {item.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.summary}
                  </p>
                )}
              </div>
            </div>
            {item.url && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 mt-2"
                onClick={() => window.open(item.url, '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Read More
              </Button>
            )}
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
