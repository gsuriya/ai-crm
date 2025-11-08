"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyAvatarProps {
  name: string;
  logoUrl?: string | null;
  domain?: string | null;
  website?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * CompanyAvatar component that displays company logo or falls back to initials
 * Uses Clearbit's logo API as a fallback if logo_url is not set
 */
export function CompanyAvatar({
  name,
  logoUrl,
  domain,
  website,
  size = "md",
  className,
}: CompanyAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [clearbitError, setClearbitError] = useState(false);

  // Extract domain from website if provided
  const getDomain = (): string | null => {
    if (domain) return domain;
    if (website) {
      try {
        const url = new URL(website.startsWith("http") ? website : `https://${website}`);
        return url.hostname.replace("www.", "");
      } catch {
        return null;
      }
    }
    return null;
  };

  const companyDomain = getDomain();
  
  // Try logo_url first, then Clearbit API, then fallback to initials
  const logoSource = logoUrl && !imageError 
    ? logoUrl 
    : companyDomain && !clearbitError 
      ? `https://logo.clearbit.com/${companyDomain}`
      : null;

  const sizeClasses = {
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm",
    lg: "h-12 w-12 text-base",
  };

  const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  return (
    <div
      className={cn(
        "rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden",
        sizeClasses[size],
        className
      )}
    >
      {logoSource ? (
        <img
          src={logoSource}
          alt={`${name} logo`}
          className="w-full h-full object-cover"
          onError={() => {
            if (logoUrl && !imageError) {
              // If logo_url failed, try Clearbit
              setImageError(true);
            } else {
              // If Clearbit also failed, show initials
              setClearbitError(true);
            }
          }}
        />
      ) : (
        <span className="font-medium text-primary flex items-center justify-center">
          {imageError && clearbitError ? (
            <Building2 className={cn("text-primary", size === "sm" ? "h-3 w-3" : size === "md" ? "h-4 w-4" : "h-5 w-5")} />
          ) : (
            getInitials(name)
          )}
        </span>
      )}
    </div>
  );
}

