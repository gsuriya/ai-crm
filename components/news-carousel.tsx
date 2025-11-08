"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Newspaper } from "lucide-react";
import Image from "next/image";

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
  // Using a realistic news article layout with gradient blur (clear at top, blurred at bottom)
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      {/* Base layer - all content */}
      <div className="absolute inset-0 p-2 space-y-1.5 opacity-40">
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
      
      {/* Blurred overlay layer - gradient mask makes it fade in from top to bottom */}
      <div 
        className="absolute inset-0 p-2 space-y-1.5 opacity-40 grayscale(60%)"
        style={{ 
          filter: 'blur(3px)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, transparent 25%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.7) 60%, black 80%, black 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, transparent 25%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.7) 60%, black 80%, black 100%)',
          pointerEvents: 'none'
        }}
      >
        {/* Same content structure */}
        <div className="flex items-center gap-1 mb-1">
          <div className="h-1.5 w-12 bg-gray-700 rounded"></div>
          <div className="h-1 w-16 bg-gray-500 rounded"></div>
        </div>
        <div className="h-2 bg-gray-800 rounded w-5/6 font-bold"></div>
        <div className="h-1.5 bg-gray-700 rounded w-4/5"></div>
        <div className="flex items-center gap-2 mt-1">
          <div className="h-1 w-20 bg-gray-400 rounded"></div>
          <div className="h-1 w-16 bg-gray-400 rounded"></div>
        </div>
        <div className="space-y-1 mt-2">
          <div className="h-1 bg-gray-600 rounded w-full"></div>
          <div className="h-1 bg-gray-600 rounded w-11/12"></div>
          <div className="h-1 bg-gray-600 rounded w-full"></div>
          <div className="h-1 bg-gray-600 rounded w-5/6"></div>
        </div>
        <div className="h-3 bg-gray-300 rounded mt-1.5"></div>
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
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false); // Use ref for synchronous access
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { 
      loop: true,
      align: "start",
      direction: "ltr",
      skipSnaps: true,
      dragFree: false,
      dragThreshold: 1000, // Effectively disable drag
    }
  );

  // Duplicate articles for seamless infinite scroll
  const duplicatedArticles = [...articles, ...articles];

  const scrollPositionRef = useRef(0);
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pausedPositionRef = useRef<number | null>(null);
  
  // Scroll state
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUserScrollingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartPositionRef = useRef(0);
  const hasDragStartedRef = useRef(false);
  const dragMoveHandlerRef = useRef<((e: MouseEvent | TouchEvent) => void) | null>(null);
  const dragEndHandlerRef = useRef<(() => void) | null>(null);

  // Synchronous pause handler that immediately locks position
  const handlePause = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    
    // Immediately lock the current position synchronously
    if (innerContainerRef.current) {
      // Capture current position if not already captured
      if (pausedPositionRef.current === null) {
        pausedPositionRef.current = scrollPositionRef.current;
      }
      // Apply transform immediately - this happens synchronously before next frame
      innerContainerRef.current.style.transform = `translateX(-${pausedPositionRef.current}px)`;
      // Force synchronous layout recalculation to ensure transform is applied
      void innerContainerRef.current.offsetHeight;
    }
  }, []);

  // Synchronous resume handler
  const handleResume = useCallback(() => {
    // Only resume if not user scrolling
    if (!isUserScrollingRef.current) {
      isPausedRef.current = false;
      setIsPaused(false);
    }
  }, []);

  // Wheel scroll handler
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    const innerContainer = innerContainerRef.current;
    if (!innerContainer) return;
    
    // Pause auto-scroll
    isUserScrollingRef.current = true;
    isPausedRef.current = true;
    setIsPaused(true);
    
    // Capture current position if not already captured
    if (pausedPositionRef.current === null) {
      pausedPositionRef.current = scrollPositionRef.current;
    }
    
    // Calculate new position based on wheel delta
    const cardWidth = 140;
    const gap = 8;
    const cardWithGap = cardWidth + gap;
    const maxScroll = articles.length * cardWithGap;
    
    // Use deltaX for horizontal scrolling (trackpad) or deltaY for vertical scrolling (mouse wheel)
    const scrollDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    
    let newPosition = scrollPositionRef.current + scrollDelta;
    
    // Handle wrapping
    if (newPosition < 0) {
      newPosition = maxScroll + (newPosition % maxScroll);
    } else if (newPosition > maxScroll) {
      newPosition = newPosition % maxScroll;
    }
    
    scrollPositionRef.current = newPosition;
    pausedPositionRef.current = newPosition;
    innerContainer.style.transform = `translateX(-${newPosition}px)`;
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Resume auto-scroll after 3 seconds of inactivity
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
      isPausedRef.current = false;
      setIsPaused(false);
    }, 3000);
  }, [articles.length]);

  // Drag handlers - work exactly like wheel scroll
  const handleDragStart = useCallback((e: MouseEvent | TouchEvent) => {
    const innerContainer = innerContainerRef.current;
    if (!innerContainer) return;
    
    // Capture starting position
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    dragStartXRef.current = clientX;
    dragStartPositionRef.current = scrollPositionRef.current;
    hasDragStartedRef.current = true;
    
    // Attach global listeners for drag move and end
    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      // Only process if we've actually started a drag (mousedown happened)
      if (!hasDragStartedRef.current) return;
      
      const innerContainer = innerContainerRef.current;
      if (!innerContainer) return;
      
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = Math.abs(dragStartXRef.current - clientX);
      
      // Only start dragging if moved more than 5px (allows clicks to work)
      if (!isDraggingRef.current && deltaX < 5) {
        return;
      }
      
      // Now we're actually dragging
      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        isUserScrollingRef.current = true;
        isPausedRef.current = true;
        setIsPaused(true);
        
        if (pausedPositionRef.current === null) {
          pausedPositionRef.current = scrollPositionRef.current;
        }
      }
      
      moveEvent.preventDefault();
      
      const currentDeltaX = dragStartXRef.current - clientX; // Inverted because we're dragging left/right
      
      const cardWidth = 140;
      const gap = 8;
      const cardWithGap = cardWidth + gap;
      const maxScroll = articles.length * cardWithGap;
      
      let newPosition = dragStartPositionRef.current + currentDeltaX;
      
      // Handle wrapping
      if (newPosition < 0) {
        newPosition = maxScroll + (newPosition % maxScroll);
      } else if (newPosition > maxScroll) {
        newPosition = newPosition % maxScroll;
      }
      
      scrollPositionRef.current = newPosition;
      pausedPositionRef.current = newPosition;
      innerContainer.style.transform = `translateX(-${newPosition}px)`;
    };
    
    const handleEnd = () => {
      // Only handle if we've started a drag
      if (!hasDragStartedRef.current) return;
      
      hasDragStartedRef.current = false;
      
      // Only handle pause/resume if we were actually dragging
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        
        // Clear existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        
        // Resume auto-scroll after 3 seconds of inactivity
        scrollTimeoutRef.current = setTimeout(() => {
          isUserScrollingRef.current = false;
          isPausedRef.current = false;
          setIsPaused(false);
        }, 3000);
      }
      
      // Reset drag start position
      dragStartXRef.current = 0;
      dragStartPositionRef.current = 0;
      
      // Remove listeners after drag ends
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
    
    dragMoveHandlerRef.current = handleMove;
    dragEndHandlerRef.current = handleEnd;
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  }, [articles.length]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    // Only process if we've actually started a drag (mousedown happened)
    if (!hasDragStartedRef.current) return;
    
    const innerContainer = innerContainerRef.current;
    if (!innerContainer) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = Math.abs(dragStartXRef.current - clientX);
    
    // Only start dragging if moved more than 5px (allows clicks to work)
    if (!isDraggingRef.current && deltaX < 5) {
      return;
    }
    
    // Now we're actually dragging
    if (!isDraggingRef.current) {
      isDraggingRef.current = true;
      isUserScrollingRef.current = true;
      isPausedRef.current = true;
      setIsPaused(true);
      
      if (pausedPositionRef.current === null) {
        pausedPositionRef.current = scrollPositionRef.current;
      }
    }
    
    e.preventDefault();
    
    const currentDeltaX = dragStartXRef.current - clientX; // Inverted because we're dragging left/right
    
    const cardWidth = 140;
    const gap = 8;
    const cardWithGap = cardWidth + gap;
    const maxScroll = articles.length * cardWithGap;
    
    let newPosition = dragStartPositionRef.current + currentDeltaX;
    
    // Handle wrapping
    if (newPosition < 0) {
      newPosition = maxScroll + (newPosition % maxScroll);
    } else if (newPosition > maxScroll) {
      newPosition = newPosition % maxScroll;
    }
    
    scrollPositionRef.current = newPosition;
    pausedPositionRef.current = newPosition;
    innerContainer.style.transform = `translateX(-${newPosition}px)`;
  }, [articles.length]);

  const handleDragEnd = useCallback(() => {
    // Only handle if we've started a drag
    if (!hasDragStartedRef.current) return;
    
    hasDragStartedRef.current = false;
    
    // Only handle pause/resume if we were actually dragging
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Resume auto-scroll after 3 seconds of inactivity
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
        isPausedRef.current = false;
        setIsPaused(false);
      }, 3000);
    }
    
    // Reset drag start position
    dragStartXRef.current = 0;
    dragStartPositionRef.current = 0;
  }, []);

  // Add wheel and drag event listeners
  useEffect(() => {
    const emblaContainer = innerContainerRef.current?.parentElement;
    if (!emblaContainer) return;
    
    emblaContainer.addEventListener('wheel', handleWheel, { passive: false });
    emblaContainer.addEventListener('mousedown', handleDragStart, { passive: false });
    emblaContainer.addEventListener('touchstart', handleDragStart, { passive: false });
    
    return () => {
      emblaContainer.removeEventListener('wheel', handleWheel);
      emblaContainer.removeEventListener('mousedown', handleDragStart);
      emblaContainer.removeEventListener('touchstart', handleDragStart);
      
      // Clean up any active drag listeners
      if (dragMoveHandlerRef.current) {
        window.removeEventListener('mousemove', dragMoveHandlerRef.current);
        window.removeEventListener('touchmove', dragMoveHandlerRef.current);
      }
      if (dragEndHandlerRef.current) {
        window.removeEventListener('mouseup', dragEndHandlerRef.current);
        window.removeEventListener('touchend', dragEndHandlerRef.current);
      }
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleWheel, handleDragStart]);

  // Removed updateOpacities - keeping all cards at full opacity

  // Combined effect for scrolling and opacity updates - runs only once
  useEffect(() => {
    const innerContainer = innerContainerRef.current;
    if (!innerContainer) return;

    let lastTime = performance.now();
    const scrollSpeed = 80; // pixels per second - MUCH FASTER
    const cardWidth = 140;
    const gap = 8;
    const cardWithGap = cardWidth + gap;
    const maxScroll = articles.length * cardWithGap;

    // Initialize scroll position to start from the end for left-to-right scrolling
    const initializeScroll = () => {
      scrollPositionRef.current = maxScroll;
      // Use transform instead of scrollLeft to bypass any scroll management
      innerContainer.style.transform = `translateX(-${maxScroll}px)`;
    };
    
    // Wait for DOM to be ready and initialize
    setTimeout(initializeScroll, 150);

    const scroll = (currentTime: number) => {
      if (!innerContainer) {
        lastTime = currentTime;
        animationFrameRef.current = requestAnimationFrame(scroll);
        return;
      }

      // Check ref for synchronous pause state or user scrolling
      if (isPausedRef.current || isUserScrollingRef.current) {
        // Keep position locked - use the paused position
        if (pausedPositionRef.current !== null) {
          innerContainer.style.transform = `translateX(-${pausedPositionRef.current}px)`;
        }
        lastTime = currentTime;
        animationFrameRef.current = requestAnimationFrame(scroll);
        return;
      }
      
      // Resume from paused position
      if (pausedPositionRef.current !== null) {
        scrollPositionRef.current = pausedPositionRef.current;
        pausedPositionRef.current = null;
      }

      try {
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;

        const pixelsToScroll = (scrollSpeed * deltaTime) / 1000;
        // DECREASE for left-to-right scrolling
        scrollPositionRef.current -= pixelsToScroll;
        
        // Loop seamlessly
        if (scrollPositionRef.current <= 0) {
          scrollPositionRef.current = maxScroll;
        }

        // Use CSS transform to move the container - this bypasses scroll management
        innerContainer.style.transform = `translateX(-${scrollPositionRef.current}px)`;
      } catch (error) {
        console.error("Carousel scroll error:", error);
      }
      
      animationFrameRef.current = requestAnimationFrame(scroll);
    };

    // Start scrolling after a delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      animationFrameRef.current = requestAnimationFrame(scroll);
    }, 400);

    return () => {
      clearTimeout(timeoutId);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [articles.length]); // Single combined effect

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
      className="pb-3 relative"
    >
      {/* Left fade gradient */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background via-background/50 to-transparent pointer-events-none z-10" />
      
      {/* Right fade gradient */}
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background via-background/50 to-transparent pointer-events-none z-10" />
      
      <div 
        className="overflow-x-hidden overflow-y-hidden scrollbar-hide" 
        ref={emblaRef}
        style={{
          willChange: 'transform',
        }}
      >
        <div 
          ref={innerContainerRef}
          className="flex gap-2 px-1"
          style={{
            width: 'max-content',
            display: 'flex',
            transition: 'none',
          }}
        >
          {duplicatedArticles.map((article, index) => {
            const isCEOPhoto = article.imageType === "ceo" && article.imageUrl;
            
            return (
              <CardWithGradient
                key={`${article.id}-${index}`}
                article={article}
                index={index}
                articlesLength={articles.length}
                opacity={1.0}
                isCEOPhoto={isCEOPhoto}
                onHoverStart={handlePause}
                onHoverEnd={handleResume}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CardWithGradient({ 
  article, 
  index, 
  articlesLength, 
  opacity,
  isCEOPhoto,
  onHoverStart,
  onHoverEnd
}: { 
  article: NewsArticle; 
  index: number; 
  articlesLength: number;
  opacity: number;
  isCEOPhoto: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    onHoverStart(); // Pause carousel immediately
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    onHoverEnd(); // Resume carousel
  };

  return (
    <div
      className="flex-shrink-0 w-[140px] group cursor-pointer"
      onClick={() => window.open(article.url, "_blank")}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ 
        opacity, 
        transition: 'opacity 0.3s ease-out, transform 0.12s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform',
        transform: isHovered ? 'translateY(-12px)' : 'translateY(0)',
      }}
    >
                <div className="relative overflow-hidden border border-gray-200/30 bg-white flex flex-col shadow-sm hover:shadow-md transition-shadow duration-150" style={{ height: 'auto', maxHeight: '120px' }}>
                  {/* Image Section */}
                  <div className="relative h-10 w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
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

                  {/* Content section with gradient overlay */}
                  <div className="p-1.5 flex-1 flex flex-col bg-white border-t border-gray-100/50 relative overflow-hidden">
                    {/* Gradient overlay with smooth pulsing animation */}
                    <div
                      className="absolute inset-0 pointer-events-none z-0"
                      style={{
                        background: "linear-gradient(to top, rgba(147, 197, 253, 0.5) 0%, rgba(196, 181, 253, 0.4) 30%, rgba(251, 207, 232, 0.3) 60%, rgba(251, 207, 232, 0.15) 80%, transparent 100%)",
                        opacity: isHovered ? 1 : 0,
                        transition: 'opacity 0.12s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    />
                    
                    {/* Content wrapper */}
                    <div className="flex-1 flex flex-col relative z-10">
                      {/* Company Name */}
                      <h3 className="text-[10px] font-semibold text-gray-900 mb-0.5 line-clamp-1 leading-tight tracking-tight">
                        {article.company}
                      </h3>
                      
                      {/* Title */}
                      <p className="text-[9px] text-gray-600 line-clamp-2 mb-1.5 leading-snug flex-1 font-normal">
                        {article.title}
                      </p>

                      {/* Footer: Source + Time */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100/50 mt-auto">
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
                </div>
    </div>
  );
}
