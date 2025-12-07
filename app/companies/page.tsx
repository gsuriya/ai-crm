"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, ArrowUp, Bot, Building2 } from "lucide-react";
import { motion } from "framer-motion";

export const dynamic = 'force-dynamic';

interface Company {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
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

  const performSearch = useCallback(() => {
    setSearchQuery(searchInput.trim());
  }, [searchInput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      performSearch();
    }
  };

  const filteredCompanies = useMemo(() => {
    if (!searchQuery) {
      return companies;
    }
    
    const query = searchQuery.toLowerCase();
    return companies.filter((company) => {
      const name = company.name?.toLowerCase() || "";
      return name.includes(query);
    });
  }, [companies, searchQuery]);

  const getInitials = (name: string) => {
    const words = name.split(' ').filter(word => word.length > 0);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
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
                  placeholder="Search companies..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent border-0 outline-none text-sm text-gray-900 placeholder:text-gray-600 pr-2"
                />
                <button
                  onClick={performSearch}
                  disabled={!searchInput.trim()}
                  className="ml-2 flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all disabled:hover:bg-indigo-600"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-8 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-600">Loading companies...</div>
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
                  <th className="px-7 py-4 text-right text-sm font-semibold text-gray-900 select-none">
                    Added
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((company, index) => {
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
                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                              <span className="text-sm font-semibold text-indigo-600">
                                {getInitials(company.name)}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-base font-medium text-gray-900 truncate leading-6">
                                {company.name}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </td>
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
