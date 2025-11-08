"use client";

import { useState, useEffect } from "react";
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
      <div className="py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-muted rounded w-1/2"></div>
          <div className="h-16 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="py-6">
        <div className="flex items-center gap-2 mb-6">
          <Newspaper className="h-4 w-4 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">
            Recent News
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">No recent news found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
        {news.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4 rounded-xl bg-muted/20 hover:bg-muted/40 transition-all duration-200"
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
    </div>
  );
}
