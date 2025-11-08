"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, ArrowUp, Bot, Newspaper } from "lucide-react";
import { motion } from "framer-motion";
import { MatchIndicator } from "@/components/match-indicator";
import { MatchSnippet } from "@/components/match-snippet";
import { CompanyAvatar } from "@/components/company/company-avatar";
import { NewsCarousel } from "@/components/news-carousel";
import type { SearchMatch } from "@/lib/semantic-search";

export const dynamic = 'force-dynamic';

// Mock news data - realistic startup funding rounds
const mockNewsArticles = [
  {
    id: "1",
    title: "Raises $2.5M pre-seed round led by Y Combinator to build AI-powered sales automation",
    company: "Revflow",
    imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces",
    imageType: "ceo" as const,
    source: "TechCrunch",
    sourceLogoUrl: "https://logo.clearbit.com/techcrunch.com",
    category: "funding" as const,
    amount: "$2.5M",
    daysAgo: 0,
    url: "https://techcrunch.com",
  },
  {
    id: "2",
    title: "Secures $8M seed funding from a16z to expand developer tools platform",
    company: "Codebase",
    imageType: "news" as const,
    source: "The Information",
    sourceLogoUrl: "https://logo.clearbit.com/theinformation.com",
    category: "funding" as const,
    amount: "$8M",
    daysAgo: 1,
    url: "https://theinformation.com",
  },
  {
    id: "3",
    title: "Closes $15M Series A led by Sequoia to scale enterprise security platform",
    company: "ShieldAI",
    imageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=faces",
    imageType: "ceo" as const,
    source: "StrictlyVC",
    sourceLogoUrl: "https://logo.clearbit.com/strictlyvc.com",
    category: "funding" as const,
    amount: "$15M",
    daysAgo: 2,
    url: "https://strictlyvc.com",
  },
  {
    id: "4",
    title: "Raises $32M Series B from Accel to accelerate growth in European markets",
    company: "Dataflow",
    imageType: "news" as const,
    source: "Bloomberg",
    sourceLogoUrl: "https://logo.clearbit.com/bloomberg.com",
    category: "funding" as const,
    amount: "$32M",
    daysAgo: 3,
    url: "https://bloomberg.com",
  },
  {
    id: "5",
    title: "Partners with Microsoft to integrate AI capabilities into enterprise workflow tools",
    company: "Taskforce",
    imageUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=faces",
    imageType: "ceo" as const,
    source: "Forbes",
    sourceLogoUrl: "https://logo.clearbit.com/forbes.com",
    category: "partnership" as const,
    daysAgo: 4,
    url: "https://forbes.com",
  },
  {
    id: "6",
    title: "Acquires competitor CloudSync to expand market presence in SaaS integration space",
    company: "IntegrateHub",
    imageType: "news" as const,
    source: "TechCrunch",
    sourceLogoUrl: "https://logo.clearbit.com/techcrunch.com",
    category: "acquisition" as const,
    daysAgo: 5,
    url: "https://techcrunch.com",
  },
  {
    id: "7",
    title: "Raises $1.8M pre-seed from First Round Capital to build next-gen CRM platform",
    company: "SalesPulse",
    imageUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=faces",
    imageType: "ceo" as const,
    source: "StrictlyVC",
    sourceLogoUrl: "https://logo.clearbit.com/strictlyvc.com",
    category: "funding" as const,
    amount: "$1.8M",
    daysAgo: 6,
    url: "https://strictlyvc.com",
  },
  {
    id: "8",
    title: "Secures $12M Series A from Index Ventures to scale AI-powered analytics platform",
    company: "AnalyticsAI",
    imageType: "news" as const,
    source: "The Verge",
    sourceLogoUrl: "https://logo.clearbit.com/theverge.com",
    category: "funding" as const,
    amount: "$12M",
    daysAgo: 7,
    url: "https://theverge.com",
  },
];

interface Company {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  arr?: number;
  funding_amount?: number;
  industry?: string;
  website?: string;
  logo_url?: string;
}

interface Contact {
  id: string;
  company_id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
}

interface Cadence {
  id: string;
  name: string;
  user_id: string;
}

interface CompanyWithMatches extends Company {
  matches?: SearchMatch[];
}

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Map<string, Contact[]>>(new Map());
  const [cadences, setCadences] = useState<Cadence[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<Map<string, SearchMatch[]>>(new Map());
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [agentMode, setAgentMode] = useState(false);

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      // Group contacts by company_id
      const contactsMap = new Map<string, Contact[]>();
      (data || []).forEach((contact) => {
        const existing = contactsMap.get(contact.company_id) || [];
        contactsMap.set(contact.company_id, [...existing, contact]);
      });
      
      setContacts(contactsMap);
    } catch (error) {
      console.error("Error fetching contacts:", error);
    }
  }, []);

  const fetchCadences = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[Companies] No user found, cadences will be empty');
        setCadences([]);
        return;
      }

      // All cadences are shared company-wide - no user filter (same as cadences page)
      const { data, error } = await supabase
        .from("cadences")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error('[Companies] Error fetching cadences:', error);
        throw error;
      }
      
      console.log('[Companies] Fetched cadences:', data?.length || 0, data);
      setCadences(data || []);
    } catch (error) {
      console.error("Error fetching cadences:", error);
      setCadences([]);
    }
  }, []);


  useEffect(() => {
    fetchCompanies();
    fetchContacts();
    fetchCadences();
  }, [fetchCompanies, fetchContacts, fetchCadences]);

  // Perform search manually (triggered by Enter key or button click)
  const performSearch = useCallback(async () => {
    const query = searchInput.trim();
    
    if (!query || query.length < 2) {
      setSearchQuery("");
      setSearchMatches(new Map());
      setIsSemanticSearch(false);
      return;
    }

    setSearchQuery(query);
    setIsSemanticSearch(true);
    setSearchLoading(true);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          limit: 50,
          threshold: 0.3,
        }),
      });

      if (response.ok) {
        const { results } = await response.json();
        const matchesMap = new Map<string, SearchMatch[]>();
        
        results.forEach((match: SearchMatch) => {
          const existing = matchesMap.get(match.company_id) || [];
          matchesMap.set(match.company_id, [...existing, match]);
        });

        setSearchMatches(matchesMap);
      }
    } catch (error) {
      console.error('Error performing search:', error);
    } finally {
      setSearchLoading(false);
    }
  }, [searchInput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      performSearch();
    }
  };

  const filteredCompanies = useMemo(() => {
    if (!searchQuery) {
      // No search query, show all companies
      return companies;
    }
    
    if (isSemanticSearch && searchMatches.size > 0) {
      // Return companies that have matches
      const matchedCompanyIds = Array.from(searchMatches.keys());
      return companies.filter(c => matchedCompanyIds.includes(c.id));
    } else if (isSemanticSearch && searchMatches.size === 0 && !searchLoading) {
      // Semantic search completed but no matches
      return [];
    } else {
      // Regular text search (fallback)
      return companies.filter((company) =>
        company.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  }, [companies, searchQuery, isSemanticSearch, searchMatches, searchLoading]);

  // Highlight matching terms in text - handles partial matches like "food" in "FoodTech"
  const highlightMatchText = (text: string, query?: string) => {
    if (!query || query.length < 2) {
      return text;
    }

    // Extract key terms from query (simple word extraction)
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    if (queryWords.length === 0) {
      return text;
    }

    // Find the first matching word (for partial matches like "food" in "FoodTech")
    for (const word of queryWords) {
      const index = text.toLowerCase().indexOf(word.toLowerCase());
      if (index >= 0) {
        const beforeMatch = text.slice(0, index);
        const match = text.slice(index, index + word.length);
        const afterMatch = text.slice(index + word.length);
        
        return (
          <>
            {beforeMatch}
            <strong className="font-semibold bg-accent/50 px-0.5 rounded">{match}</strong>
            {afterMatch}
          </>
        );
      }
    }

    return text;
  };

  return (
    <div className="flex flex-col bg-background min-h-screen" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {/* Header */}
      <div className="bg-background">
        <div className="max-w-7xl mx-auto px-8 pt-6 pb-2">
          <div className="mb-8 pt-0">
            <h1 className="text-2xl font-semibold text-gray-900 leading-6">Companies</h1>
          </div>
          <div className="mb-2">
            <div className="relative max-w-2xl mx-auto">
              <div className="relative flex items-center bg-background border-2 border-indigo-600 rounded-full px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-indigo-600 transition-all">
                <input
                  type="text"
                  placeholder={agentMode ? "Give agent commands (e.g., 'add SaaS companies to warm outreach cadence')..." : "Search companies..."}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent border-0 outline-none text-sm text-gray-900 placeholder:text-gray-600 pr-2"
                  disabled={searchLoading}
                />
                <button
                  onClick={() => setAgentMode(!agentMode)}
                  className={`ml-2 flex items-center justify-center h-8 w-8 rounded-full transition-all ${
                    agentMode 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  title={agentMode ? "Disable Agent Mode" : "Enable Agent Mode"}
                >
                  <Bot className="h-4 w-4" />
                </button>
                <button
                  onClick={performSearch}
                  disabled={searchLoading || !searchInput.trim()}
                  className="ml-2 flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all disabled:hover:bg-indigo-600"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
              {agentMode && (
                <div className="mt-2 text-xs text-gray-600 text-center">
                  <Bot className="h-3 w-3 inline mr-1" />
                  Agent Mode: I&apos;ll automatically find companies and add them to cadences based on your commands
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Company News Section */}
      <div className="bg-background border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-8 pt-2 pb-2">
          <NewsCarousel articles={mockNewsArticles} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-8 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-600">Loading companies...</div>
          </div>
        ) : searchLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="flex items-center gap-2 text-gray-900">
                <span className="text-lg font-medium">Finding companies</span>
                <motion.div
                  className="flex gap-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-indigo-600"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </motion.div>
              </div>
              <p className="text-sm text-gray-600">
                Searching through company data...
              </p>
            </motion.div>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-gray-600">
              {searchQuery ? "No companies found matching your search." : "No companies yet. Add your first company to get started."}
            </div>
          </div>
        ) : (
          <div>
            <table className="w-full border-collapse">
              <thead className="bg-background">
                <tr>
                  <th className="px-7 py-4 text-left text-sm font-semibold text-gray-900 select-none">
                    Name
                  </th>
                  {isSemanticSearch && (
                    <th className="px-7 py-4 text-left text-sm font-semibold text-gray-900 select-none">
                      Matches
                    </th>
                  )}
                  <th className="px-7 py-4 text-right text-sm font-semibold text-gray-900 select-none">
                    Added
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((company, index) => {
                  const matches = searchMatches.get(company.id) || [];
                  const topMatch = matches[0];
                  const companyContacts = contacts.get(company.id) || [];
                  
                  // Find CEO first, then any contact with email, then any contact
                  const ceo = companyContacts.find(c => 
                    c.title && (c.title.toLowerCase().includes('ceo') || c.title.toLowerCase().includes('chief executive'))
                  );
                  const firstContact = ceo || companyContacts.find(c => c.email && c.email.trim() !== '') || companyContacts[0];
                  
                  // Display name only (no title), otherwise email, otherwise "No contact listed"
                  const displayText = ceo 
                    ? `${ceo.first_name} ${ceo.last_name}`
                    : firstContact && firstContact.first_name && firstContact.last_name
                      ? `${firstContact.first_name} ${firstContact.last_name}`
                      : firstContact && firstContact.email && firstContact.email.trim() !== ''
                        ? firstContact.email
                        : "No contact listed";

                  return (
                    <motion.tr
                      key={company.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="group hover:bg-indigo-50/50 transition-colors border-b border-gray-100"
                    >
                      <td className="px-7 py-5 text-sm">
                        <Link href={`/companies/${company.id}`} className="block">
                          <div className="flex items-center space-x-3">
                            <CompanyAvatar
                              name={company.name}
                              logoUrl={company.logo_url}
                              website={company.website}
                              size="md"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-base font-medium text-gray-900 truncate leading-6">
                                {company.name}
                              </div>
                              <div className="text-sm text-gray-600 truncate leading-5 mt-0.5">
                                {displayText}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </td>
                      {isSemanticSearch && (
                        <td className="px-7 py-5 text-sm">
                          {topMatch ? (
                            <div className="flex items-center gap-2 max-w-md">
                              <MatchIndicator 
                                contentType={topMatch.content_type} 
                                source={topMatch.source}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-gray-900 bg-accent/30 rounded px-2 py-1 truncate">
                                  &quot;{highlightMatchText(topMatch.content_snippet.slice(0, 120), searchQuery)}{topMatch.content_snippet.length > 120 ? '...' : ''}&quot;
                                </div>
                              </div>
                              {matches.length > 1 && (
                                <span className="text-xs text-gray-600 whitespace-nowrap">
                                  +{matches.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-600">—</div>
                          )}
                        </td>
                      )}
                      <td className="px-7 py-5 text-sm">
                        <div className="text-sm text-gray-600 text-right leading-5">
                          {new Date(company.created_at).toLocaleDateString()}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
