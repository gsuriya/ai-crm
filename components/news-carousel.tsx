"use client";

import { useState, useEffect, useRef } from "react";
import { Newspaper } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";

interface NewsArticle {
  id: string;
  title: string;
  company: string;
  imageUrl?: string;
  imageType?: "ceo" | "news";
  source: string;
  sourceLogoUrl?: string;
  category: "funding" | "acquisition" | "product" | "partnership";
  amount?: string;
  daysAgo: number;
  url: string;
}

interface NewsCarouselProps {
  articles: NewsArticle[];
}

function formatTimeAgo(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// News article preview background component
function NewsArticlePreview() {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 overflow-hidden">
      {/* Simulated news article text lines */}
      <div className="absolute inset-0 opacity-[0.15]">
        <div className="p-3 space-y-2">
          <div className="h-1.5 bg-gray-400 rounded w-3/4 blur-[0.5px]"></div>
          <div className="h-1.5 bg-gray-400 rounded w-full blur-[0.5px]"></div>
          <div className="h-1.5 bg-gray-400 rounded w-5/6 blur-[0.5px]"></div>
          <div className="h-1.5 bg-gray-400 rounded w-4/5 blur-[0.5px] mt-3"></div>
          <div className="h-1.5 bg-gray-400 rounded w-full blur-[0.5px]"></div>
          <div className="h-1.5 bg-gray-400 rounded w-3/4 blur-[0.5px]"></div>
        </div>
      </div>
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
          backgroundSize: '16px 16px'
        }}
      />
    </div>
  );
}

export function NewsCarousel({ articles }: NewsCarouselProps) {
  const [hasError, setHasError] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);
  const [isPaused, setIsPaused] = useState(false);

  // Duplicate articles for seamless infinite scroll
  const duplicatedArticles = [...articles, ...articles];

  useEffect(() => {
    if (!scrollContainerRef.current || articles.length === 0) return;

    const container = scrollContainerRef.current;
    const scrollWidth = container.scrollWidth;
    const singleSetWidth = scrollWidth / 2; // Since we duplicated the articles

    const scroll = () => {
      if (isPaused) return;

      scrollPositionRef.current += 0.5; // Scroll speed (pixels per frame)
      
      if (scrollPositionRef.current >= singleSetWidth) {
        scrollPositionRef.current = 0; // Reset to start for seamless loop
      }

      container.scrollLeft = scrollPositionRef.current;
    };

    const intervalId = setInterval(scroll, 16); // ~60fps

    return () => clearInterval(intervalId);
  }, [articles, isPaused]);

  // Pause on hover
  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);

  if (hasError) {
    return (
      <div className="flex items-center justify-center py-6 bg-gradient-to-br from-gray-50/50 to-gray-100/50 rounded-xl border border-gray-200/50 backdrop-blur-sm">
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <Newspaper className="w-8 h-8 text-gray-300 stroke-[1.5]" />
          </div>
          <p className="text-sm text-gray-500">No recent news</p>
        </div>
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 bg-gradient-to-br from-gray-50/50 to-gray-100/50 rounded-xl border border-gray-200/50 backdrop-blur-sm">
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <Newspaper className="w-8 h-8 text-gray-300 stroke-[1.5]" />
          </div>
          <p className="text-sm text-gray-500">No recent news</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="py-6 bg-gradient-to-br from-gray-50/40 via-gray-50/60 to-gray-100/40 rounded-xl border border-gray-200/60 backdrop-blur-sm shadow-sm relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Left fade gradient */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-gray-50/40 via-gray-50/20 to-transparent pointer-events-none z-10" />
      
      {/* Right fade gradient */}
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-gray-50/40 via-gray-50/20 to-transparent pointer-events-none z-10" />
      
      <div 
        ref={scrollContainerRef}
        className="overflow-x-auto overflow-y-hidden scrollbar-hide"
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'auto' // Changed to 'auto' for programmatic scrolling
        }}
      >
        <div className="flex gap-3 px-1" style={{ width: 'max-content' }}>
          {duplicatedArticles.map((article, index) => {
            const isCEOPhoto = article.imageType === "ceo" && article.imageUrl;
            const isNewsStyle = article.imageType === "news" || (!article.imageType && !article.imageUrl);
            
            return (
              <motion.div
                key={`${article.id}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (index % articles.length) * 0.05, duration: 0.3 }}
                className="flex-shrink-0 w-[200px] group cursor-pointer"
                onClick={() => window.open(article.url, "_blank")}
              >
                <div className="relative overflow-hidden rounded-xl border border-gray-200/80 bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 hover:border-indigo-300/60 transition-all duration-300 h-full flex flex-col group-hover:-translate-y-1">
                  {/* Image Section */}
                  <div className="relative h-24 w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                    {isCEOPhoto ? (
                      <>
                        <Image
                          src={article.imageUrl!}
                          alt={article.company}
                          fill
                          className="object-cover object-center transition-transform duration-700 group-hover:scale-110"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                      </>
                    ) : (
                      <NewsArticlePreview />
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-3 flex-1 flex flex-col bg-white/95">
                    {/* Company Name */}
                    <h3 className="text-xs font-semibold text-gray-900 mb-1.5 line-clamp-1 group-hover:text-indigo-600 transition-colors leading-tight tracking-tight">
                      {article.company}
                    </h3>
                    
                    {/* Title */}
                    <p className="text-[11px] text-gray-600 line-clamp-2 mb-3 leading-snug flex-1 font-normal">
                      {article.title}
                    </p>

                    {/* Footer: Source + Time */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-gray-100/80 mt-auto">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {article.sourceLogoUrl && (
                          <div className="w-3.5 h-3.5 relative rounded overflow-hidden flex-shrink-0 ring-1 ring-gray-200/50">
                            <img
                              src={article.sourceLogoUrl}
                              alt={article.source}
                              className="w-full h-full object-contain p-0.5"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <span className="text-[9px] font-medium text-gray-600 truncate">
                          {article.source}
                        </span>
                      </div>
                      <span className="text-[9px] text-gray-500 whitespace-nowrap ml-2 flex-shrink-0 font-normal">
                        {formatTimeAgo(article.daysAgo)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Subtle shine effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none translate-x-[-100%] group-hover:translate-x-[100%]" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
