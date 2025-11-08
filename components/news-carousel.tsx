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

// News article preview background component - using real news article screenshots
function NewsArticlePreview() {
  // Using a realistic news article layout with blurred text
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      {/* News article layout simulation */}
      <div className="absolute inset-0 p-2 space-y-1.5 opacity-40" style={{ filter: 'blur(2px) grayscale(60%)' }}>
        {/* Article header/logo area */}
        <div className="flex items-center gap-1 mb-1">
          <div className="h-1.5 w-12 bg-gray-700 rounded"></div>
          <div className="h-1 w-16 bg-gray-500 rounded"></div>
        </div>
        
        {/* Headline - bold and larger */}
        <div className="h-2 bg-gray-800 rounded w-5/6 font-bold"></div>
        <div className="h-1.5 bg-gray-700 rounded w-4/5"></div>
        
        {/* Byline/date */}
        <div className="flex items-center gap-2 mt-1">
          <div className="h-1 w-20 bg-gray-400 rounded"></div>
          <div className="h-1 w-16 bg-gray-400 rounded"></div>
        </div>
        
        {/* Article paragraphs */}
        <div className="space-y-1 mt-2">
          <div className="h-1 bg-gray-600 rounded w-full"></div>
          <div className="h-1 bg-gray-600 rounded w-11/12"></div>
          <div className="h-1 bg-gray-600 rounded w-full"></div>
          <div className="h-1 bg-gray-600 rounded w-5/6"></div>
        </div>
        
        {/* Image placeholder in article */}
        <div className="h-3 bg-gray-300 rounded mt-1.5"></div>
        
        {/* More text */}
        <div className="space-y-1 mt-1.5">
          <div className="h-1 bg-gray-600 rounded w-full"></div>
          <div className="h-1 bg-gray-600 rounded w-10/12"></div>
        </div>
      </div>
      
      {/* Subtle overlay for consistency */}
      <div className="absolute inset-0 bg-gray-900/10"></div>
    </div>
  );
}

export function NewsCarousel({ articles }: NewsCarouselProps) {
  const [hasError, setHasError] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);
  const [isPaused, setIsPaused] = useState(false);
  const [cardOpacities, setCardOpacities] = useState<Map<number, number>>(new Map());
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isUserScrollingRef = useRef(false);

  // Duplicate articles for seamless infinite scroll
  const duplicatedArticles = [...articles, ...articles];

  // Track manual scroll to preserve position
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    isUserScrollingRef.current = true;
    scrollPositionRef.current = scrollContainerRef.current.scrollLeft;
    
    // Reset flag after a delay
    setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 100);
  };

  // Calculate dynamic opacity based on scroll position
  useEffect(() => {
    if (!scrollContainerRef.current || articles.length === 0) return;

    const container = scrollContainerRef.current;
    
    const updateOpacities = () => {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;
      const newOpacities = new Map<number, number>();

      cardRefs.current.forEach((cardElement, index) => {
        if (!cardElement) return;
        
        const cardRect = cardElement.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distanceFromCenter = Math.abs(cardCenter - containerCenter);
        const maxDistance = containerRect.width / 2;
        
        // Calculate opacity: 1.0 at center, 0.5 at edges
        const opacity = Math.max(0.5, 1 - (distanceFromCenter / maxDistance) * 0.5);
        newOpacities.set(index, opacity);
      });

      setCardOpacities(newOpacities);
    };

    updateOpacities();
    
    // Update on scroll and periodically
    const handleScrollUpdate = () => updateOpacities();
    container.addEventListener('scroll', handleScrollUpdate);
    const intervalId = setInterval(updateOpacities, 150);
    
    return () => {
      container.removeEventListener('scroll', handleScrollUpdate);
      clearInterval(intervalId);
    };
  }, [articles, isPaused]);

  // Auto-scroll effect
  useEffect(() => {
    if (!scrollContainerRef.current || articles.length === 0) return;

    const container = scrollContainerRef.current;
    const scrollWidth = container.scrollWidth;
    const singleSetWidth = scrollWidth / 2; // Since we duplicated the articles

    const scroll = () => {
      if (isPaused || isUserScrollingRef.current) return;

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
      <div className="flex items-center justify-center py-3">
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
      <div className="flex items-center justify-center py-3">
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
      className="py-3 relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Left fade gradient */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background via-background/50 to-transparent pointer-events-none z-10" />
      
      {/* Right fade gradient */}
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background via-background/50 to-transparent pointer-events-none z-10" />
      
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-x-auto overflow-y-hidden scrollbar-hide"
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'auto'
        }}
      >
        <div className="flex gap-2 px-1" style={{ width: 'max-content' }}>
          {duplicatedArticles.map((article, index) => {
            const isCEOPhoto = article.imageType === "ceo" && article.imageUrl;
            const isNewsStyle = article.imageType === "news" || (!article.imageType && !article.imageUrl);
            const opacity = cardOpacities.get(index) ?? 1.0;
            
            return (
              <motion.div
                key={`${article.id}-${index}`}
                ref={(el) => {
                  if (el) cardRefs.current.set(index, el);
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (index % articles.length) * 0.05, duration: 0.3 }}
                className="flex-shrink-0 w-[140px] group cursor-pointer"
                onClick={() => window.open(article.url, "_blank")}
                style={{ opacity, transition: 'opacity 0.3s ease-out' }}
              >
                <div className="relative overflow-hidden rounded-lg border border-gray-200/30 bg-white/95 backdrop-blur-sm h-full flex flex-col transition-all duration-300">
                  {/* Image Section */}
                  <div className="relative h-16 w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                    {isCEOPhoto ? (
                      <>
                        <Image
                          src={article.imageUrl!}
                          alt={article.company}
                          fill
                          className="object-cover object-center transition-transform duration-700 group-hover:scale-110"
                          style={{ filter: 'grayscale(70%) brightness(0.95)' }}
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/20 via-transparent to-transparent" />
                        <div className="absolute inset-0 bg-gray-900/10" />
                      </>
                    ) : (
                      <NewsArticlePreview />
                    )}
                  </div>

                  {/* Content - lifts up on hover */}
                  <div className="p-2 flex-1 flex flex-col bg-white/95 group-hover:bg-gradient-to-br group-hover:from-indigo-50/50 group-hover:to-indigo-100/30 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-indigo-300/40 border-t border-gray-100/50">
                    {/* Company Name */}
                    <h3 className="text-[10px] font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-indigo-600 transition-colors leading-tight tracking-tight">
                      {article.company}
                    </h3>
                    
                    {/* Title */}
                    <p className="text-[10px] text-gray-600 line-clamp-2 mb-2 leading-snug flex-1 font-normal">
                      {article.title}
                    </p>

                    {/* Footer: Source + Time */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100/50 mt-auto">
                      <div className="flex items-center gap-1 min-w-0">
                        {article.sourceLogoUrl && (
                          <div className="w-3 h-3 relative rounded overflow-hidden flex-shrink-0 ring-1 ring-gray-200/30">
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
                        <span className="text-[8px] font-medium text-gray-600 truncate">
                          {article.source}
                        </span>
                      </div>
                      <span className="text-[8px] text-gray-500 whitespace-nowrap ml-1.5 flex-shrink-0 font-normal">
                        {formatTimeAgo(article.daysAgo)}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
