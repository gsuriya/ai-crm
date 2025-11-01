"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Search, Star, Clock, Sparkles, ArrowUp } from "lucide-react";
import { motion } from "framer-motion";
import { MatchIndicator } from "@/components/match-indicator";
import { MatchSnippet } from "@/components/match-snippet";
import type { SearchMatch } from "@/lib/semantic-search";

export const dynamic = 'force-dynamic';

interface Company {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  arr?: number;
  funding_amount?: number;
  industry?: string;
  website?: string;
}

interface CompanyWithMatches extends Company {
  matches?: SearchMatch[];
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [searchMatches, setSearchMatches] = useState<Map<string, SearchMatch[]>>(new Map());
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");

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

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

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

  const toggleSelectCompany = (companyId: string) => {
    const newSelected = new Set(selectedCompanies);
    if (newSelected.has(companyId)) {
      newSelected.delete(companyId);
    } else {
      newSelected.add(companyId);
    }
    setSelectedCompanies(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedCompanies.size === filteredCompanies.length) {
      setSelectedCompanies(new Set());
    } else {
      setSelectedCompanies(new Set(filteredCompanies.map(c => c.id)));
    }
  };

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
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border bg-background px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Companies</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your company accounts ({filteredCompanies.length})
            </p>
          </div>
        </div>
        <div className="mt-6">
          <div className="relative max-w-2xl mx-auto">
            <div className="relative flex items-center bg-background border border-border rounded-full px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:border-ring transition-all">
              <input
                type="text"
                placeholder="Search companies..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground pr-2"
                disabled={searchLoading}
              />
              <button
                onClick={performSearch}
                disabled={searchLoading || !searchInput.trim()}
                className="ml-2 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all disabled:hover:bg-primary"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading companies...</div>
          </div>
        ) : searchLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="flex items-center gap-2 text-foreground">
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
                      className="w-1.5 h-1.5 rounded-full bg-primary"
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
              <p className="text-sm text-muted-foreground">
                Searching through company data...
              </p>
            </motion.div>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-muted-foreground">
              {searchQuery ? "No companies found matching your search." : "No companies yet. Add your first company to get started."}
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-background border-b border-border">
                <tr>
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedCompanies.size === filteredCompanies.length && filteredCompanies.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring"
                    />
                  </th>
                  <th className="w-12 px-4 py-3 text-left">
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </th>
                  <th className="w-12 px-4 py-3 text-left">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    NAME
                  </th>
                  {isSemanticSearch && (
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      MATCHES
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    STATUS
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    OWNER
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    CREATED
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    EMAIL
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCompanies.map((company, index) => {
                  const matches = searchMatches.get(company.id) || [];
                  const topMatch = matches[0];

                  return (
                    <motion.tr
                      key={company.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="group hover:bg-accent/50 transition-colors cursor-pointer h-16"
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedCompanies.has(company.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelectCompany(company.id);
                          }}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <Star className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-primary" />
                      </td>
                      <td className="px-4 py-4">
                        <Clock className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/companies/${company.id}`} className="block">
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-medium text-primary">
                                {company.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-foreground truncate">
                                {company.name}
                              </div>
                              <div className="text-sm text-muted-foreground truncate">
                                {company.website || "No domain"}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </td>
                      {isSemanticSearch && (
                        <td className="px-6 py-4">
                          {topMatch ? (
                            <div className="flex items-center gap-2 max-w-md">
                              <MatchIndicator 
                                contentType={topMatch.content_type} 
                                source={topMatch.source}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-foreground bg-accent/30 rounded px-2 py-1 border border-border truncate">
                                  "{highlightMatchText(topMatch.content_snippet.slice(0, 120), searchQuery)}{topMatch.content_snippet.length > 120 ? '...' : ''}"
                                </div>
                              </div>
                              {matches.length > 1 && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  +{matches.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">—</div>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <select className="text-sm border border-border rounded-lg px-3 py-1 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" onClick={(e) => e.stopPropagation()}>
                          <option>PLEASE SELECT</option>
                          <option>QUALIFIED</option>
                          <option>LEAD</option>
                          <option>PROSPECT</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-muted-foreground">Unassigned</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-muted-foreground">
                          {new Date(company.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          placeholder="Add email"
                          className="text-sm border border-border rounded-lg px-3 py-1 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full max-w-xs"
                          onClick={(e) => e.stopPropagation()}
                        />
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
  );
}
