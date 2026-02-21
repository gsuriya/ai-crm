"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { Search, Building2, ArrowUpRight, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export const dynamic = 'force-dynamic';

interface Company {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  industry?: string;
  website?: string;
  description?: string;
  logo_url?: string;
}

// Map of well-known companies to their domains for logo lookup
const KNOWN_COMPANY_DOMAINS: Record<string, string> = {
  'google': 'google.com',
  'meta': 'meta.com',
  'facebook': 'facebook.com',
  'apple': 'apple.com',
  'amazon': 'amazon.com',
  'microsoft': 'microsoft.com',
  'netflix': 'netflix.com',
  'spotify': 'spotify.com',
  'twitter': 'twitter.com',
  'x': 'x.com',
  'linkedin': 'linkedin.com',
  'uber': 'uber.com',
  'airbnb': 'airbnb.com',
  'stripe': 'stripe.com',
  'slack': 'slack.com',
  'zoom': 'zoom.us',
  'salesforce': 'salesforce.com',
  'oracle': 'oracle.com',
  'ibm': 'ibm.com',
  'intel': 'intel.com',
  'nvidia': 'nvidia.com',
  'amd': 'amd.com',
  'tesla': 'tesla.com',
  'spacex': 'spacex.com',
  'datadog': 'datadoghq.com',
  'mckinsey': 'mckinsey.com',
  'bain': 'bain.com',
  'bcg': 'bcg.com',
  'deloitte': 'deloitte.com',
  'kpmg': 'kpmg.com',
  'pwc': 'pwc.com',
  'ey': 'ey.com',
  'accenture': 'accenture.com',
  'goldman sachs': 'goldmansachs.com',
  'jp morgan': 'jpmorgan.com',
  'jpmorgan': 'jpmorgan.com',
  'morgan stanley': 'morganstanley.com',
  'barclays': 'barclays.com',
  'blackrock': 'blackrock.com',
  'blackstone': 'blackstone.com',
  'kkr': 'kkr.com',
  'carlyle': 'carlyle.com',
  'apollo': 'apollo.com',
  'tpg': 'tpg.com',
  'warburg pincus': 'warburgpincus.com',
  'sequoia': 'sequoiacap.com',
  'andreessen horowitz': 'a16z.com',
  'a16z': 'a16z.com',
  'benchmark': 'benchmark.com',
  'greylock': 'greylock.com',
  'insight partners': 'insightpartners.com',
  'general atlantic': 'generalatlantic.com',
  'tiger global': 'tigerglobal.com',
  'softbank': 'softbank.com',
  'coatue': 'coatue.com',
  'cove hill partners': 'covehillpartners.com',
  'moelis': 'moelis.com',
  'lazard': 'lazard.com',
  'evercore': 'evercore.com',
  'centerview': 'centerviewpartners.com',
  'perella weinberg': 'pwpartners.com',
  'nyu': 'nyu.edu',
  'nyu stern': 'stern.nyu.edu',
  'harvard': 'harvard.edu',
  'stanford': 'stanford.edu',
  'mit': 'mit.edu',
  'yale': 'yale.edu',
  'princeton': 'princeton.edu',
  'columbia': 'columbia.edu',
  'berkeley': 'berkeley.edu',
  'herbalife': 'herbalife.com',
  'joylink': 'joylink.com',
};

// Get domain for a company
function getCompanyDomain(company: Company): string | null {
  // First check if company has a website
  if (company.website) {
    try {
      const url = company.website.startsWith('http') 
        ? company.website 
        : `https://${company.website}`;
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return company.website.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    }
  }

  // Check known companies (case insensitive)
  const normalizedName = company.name.toLowerCase().trim();
  
  // Direct lookup
  if (KNOWN_COMPANY_DOMAINS[normalizedName]) {
    return KNOWN_COMPANY_DOMAINS[normalizedName];
  }
  
  // Partial match for companies like "McKinsey & Company"
  for (const [key, domain] of Object.entries(KNOWN_COMPANY_DOMAINS)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return domain;
    }
  }

  return null;
}

// Component for company logo with fallback
function CompanyLogo({ 
  company, 
  size = 48,
  className = ""
}: { 
  company: Company; 
  size?: number;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);

  const getInitials = (name: string) => {
    const words = name.split(' ').filter(word => word.length > 0);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const getCompanyColor = (name: string) => {
    const colors = [
      'bg-violet-500',
      'bg-sky-500',
      'bg-emerald-500',
      'bg-amber-500',
      'bg-rose-500',
      'bg-indigo-500',
      'bg-teal-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Reset error state when company changes
  useEffect(() => {
    setHasError(false);
  }, [company.id]);

  const domain = getCompanyDomain(company);
  // Use Unavatar API - it aggregates multiple logo sources (Clearbit, Google, etc.)
  const logoUrl = company.logo_url || (domain ? `https://unavatar.io/${domain}?fallback=false` : null);

  // Show initials if no logo URL or if there was an error loading
  if (!logoUrl || hasError) {
    return (
      <div 
        className={`${getCompanyColor(company.name)} flex items-center justify-center text-white font-semibold shadow-sm flex-shrink-0 ${className}`}
        style={{ width: size, height: size, borderRadius: size * 0.25 }}
      >
        <span style={{ fontSize: size * 0.35 }}>{getInitials(company.name)}</span>
      </div>
    );
  }

  return (
    <div 
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Initials as background/fallback */}
      <div 
        className={`absolute inset-0 ${getCompanyColor(company.name)} flex items-center justify-center text-white font-semibold shadow-sm`}
        style={{ borderRadius: size * 0.25 }}
      >
        <span style={{ fontSize: size * 0.35 }}>{getInitials(company.name)}</span>
      </div>
      
      {/* Logo image on top */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-contain bg-white border border-slate-100 shadow-sm"
        style={{ borderRadius: size * 0.25 }}
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  );
}

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching companies:", error);
        setCompanies([]);
        return;
      }
      setCompanies(data || []);
    } catch (error) {
      console.error("Error fetching companies:", error);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setSearchQuery(e.target.value);
  };

  const filteredCompanies = useMemo(() => {
    if (!searchQuery) {
      return companies;
    }
    
    const query = searchQuery.toLowerCase();
    return companies.filter((company) => {
      const name = company.name?.toLowerCase() || "";
      const industry = company.industry?.toLowerCase() || "";
      return name.includes(query) || industry.includes(query);
    });
  }, [companies, searchQuery]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen ">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
          <p className="text-white/50 text-sm">Loading companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">Companies</h1>
              <p className="text-white/50 text-sm mt-1">
                {companies.length} {companies.length === 1 ? 'company' : 'companies'} in your CRM
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search companies..."
                  value={searchInput}
              onChange={handleSearch}
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
            />
          </div>
        </motion.div>

        {/* Companies Grid */}
        {filteredCompanies.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white/30" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {searchQuery ? "No companies found" : "No companies yet"}
            </h3>
            <p className="text-white/50 text-sm max-w-sm mx-auto">
              {searchQuery 
                ? "Try adjusting your search terms" 
                : "Companies will appear here when you add contacts from LinkedIn"}
            </p>
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCompanies.map((company, index) => {
                  return (
                <motion.div
                      key={company.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Link href={`/companies/${company.id}`}>
                    <div className="group bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5 hover:border-white/20 transition-all duration-300 cursor-pointer">
                      <div className="flex items-start gap-4">
                        {/* Company Logo */}
                        <CompanyLogo company={company} size={48} />
                        
                        <div className="flex-1 min-w-0">
                          {/* Company Name */}
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-white truncate group-hover:text-violet-400 transition-colors">
                                {company.name}
                            </h3>
                            <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-500 transition-colors flex-shrink-0" />
                          </div>
                          
                          {/* Industry/Description */}
                          {company.industry ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/10 text-white/60 text-xs font-medium">
                              {company.industry}
                            </span>
                          ) : company.description ? (
                            <p className="text-sm text-white/50 truncate">
                              {company.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      
                      {/* Footer */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-xs text-white/30">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDate(company.created_at)}</span>
                        </div>
                        
                        {company.website && (
                          <span className="text-xs text-white/40 truncate max-w-[120px]">
                            {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
                  );
                })}
          </div>
        )}
      </div>
    </div>
  );
}







