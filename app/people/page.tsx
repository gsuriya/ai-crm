"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, ArrowUp, Bot, User, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

export const dynamic = 'force-dynamic';

interface Person {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  title?: string;
  current_company?: string;
  job_title?: string;
  linkedin_url?: string;
  location?: string;
  profile_image_url?: string;
  created_at: string;
  updated_at: string;
}

export default function PeoplePage() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fetchPeople = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching people:", error);
        setPeople([]);
        return;
      }
      setPeople(data || []);
    } catch (error) {
      console.error("Error fetching people:", error);
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const performSearch = useCallback(() => {
    setSearchQuery(searchInput.trim());
  }, [searchInput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      performSearch();
    }
  };

  const filteredPeople = useMemo(() => {
    if (!searchQuery) {
      return people;
    }
    
    const query = searchQuery.toLowerCase();
    return people.filter((person) => {
      const fullName = `${person.first_name} ${person.last_name}`.toLowerCase();
      const company = person.current_company?.toLowerCase() || "";
      const jobTitle = person.job_title?.toLowerCase() || "";
      const email = person.email?.toLowerCase() || "";
      
      return fullName.includes(query) || 
             company.includes(query) || 
             jobTitle.includes(query) ||
             email.includes(query);
    });
  }, [people, searchQuery]);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const handleDelete = async (personId: string, personName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete ${personName}? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', personId);

      if (error) {
        console.error('Error deleting person:', error);
        alert('Failed to delete person. Please try again.');
        return;
      }

      // Refresh the list
      fetchPeople();
    } catch (error) {
      console.error('Error deleting person:', error);
      alert('Failed to delete person. Please try again.');
    }
  };

  return (
    <div className="flex flex-col bg-background min-h-screen" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {/* Header */}
      <div className="bg-background">
        <div className="max-w-7xl mx-auto px-8 pt-6 pb-2">
          <div className="mb-8 pt-0">
            <h1 className="text-2xl font-semibold text-gray-900 leading-6">People</h1>
          </div>
          <div className="mb-2">
            <div className="relative max-w-2xl mx-auto">
              <div className="relative flex items-center bg-background border-2 border-indigo-600 rounded-full px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-indigo-600 transition-all">
                <input
                  type="text"
                  placeholder="Search people..."
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
            <div className="text-gray-600">Loading people...</div>
          </div>
        ) : filteredPeople.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-gray-600">
              {searchQuery ? "No people found matching your search." : "No people yet. Add your first contact to get started."}
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
                  <th className="px-7 py-4 text-left text-sm font-semibold text-gray-900 select-none">
                    Email
                  </th>
                  <th className="px-7 py-4 text-left text-sm font-semibold text-gray-900 select-none">
                    Company
                  </th>
                  <th className="px-7 py-4 text-right text-sm font-semibold text-gray-900 select-none">
                    Added
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPeople.map((person, index) => {
                  return (
                    <motion.tr
                      key={person.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="group hover:bg-indigo-50/50 transition-colors border-b border-gray-100"
                    >
                      <td className="px-7 py-5 text-sm">
                        <Link href={`/people/${person.id}`} className="block">
                          <div className="flex items-center space-x-3">
                            {person.profile_image_url ? (
                              <img
                                src={person.profile_image_url}
                                alt={`${person.first_name} ${person.last_name}`}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                <span className="text-sm font-semibold text-indigo-600">
                                  {getInitials(person.first_name, person.last_name)}
                                </span>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-base font-medium text-gray-900 truncate leading-6">
                                {person.first_name} {person.last_name}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-7 py-5 text-sm">
                        <div className="text-sm text-gray-900 leading-5">
                          {person.email || "-"}
                        </div>
                      </td>
                      <td className="px-7 py-5 text-sm">
                        <div className="text-sm text-gray-900 leading-5">
                          {person.current_company || "-"}
                        </div>
                      </td>
                      <td className="px-7 py-5 text-sm">
                        <div className="flex items-center justify-end gap-3">
                          <div className="text-sm text-gray-600 leading-5">
                            {new Date(person.created_at).toLocaleDateString()}
                          </div>
                          <button
                            onClick={(e) => handleDelete(person.id, `${person.first_name} ${person.last_name}`, e)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-lg"
                            title="Delete person"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </button>
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


