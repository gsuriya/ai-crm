"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Building2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

interface Company {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface Person {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string;
  linkedin_url?: string;
  profile_image_url?: string;
  created_at: string;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompanyAndPeople = async () => {
      try {
        // Fetch company
        const { data: companyData, error: companyError } = await supabase
          .from("companies")
          .select("*")
          .eq("id", params.id)
          .single();

        if (companyError) {
          console.error("Error fetching company:", companyError);
          return;
        }

        setCompany(companyData);

        // Fetch people at this company
        const { data: peopleData, error: peopleError } = await supabase
          .from("contacts")
          .select("*")
          .eq("current_company", companyData.name)
          .order("created_at", { ascending: false });

        if (peopleError) {
          console.error("Error fetching people:", peopleError);
        } else {
          setPeople(peopleData || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchCompanyAndPeople();
    }
  }, [params.id]);

  const getInitials = (name: string) => {
    const words = name.split(' ').filter(word => word.length > 0);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const handleDeletePerson = async (personId: string, personName: string, e: React.MouseEvent) => {
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

      // Refresh the people list
      setPeople(people.filter(p => p.id !== personId));
    } catch (error) {
      console.error('Error deleting person:', error);
      alert('Failed to delete person. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading company...</div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-gray-600 mb-4">Company not found</div>
        <Button onClick={() => router.push("/companies")}>
          Back to Companies
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-8 py-6">
        {/* Back button */}
        <button
          onClick={() => router.push("/companies")}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Companies
        </button>

        {/* Company Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-6">
          <div className="flex items-start gap-6">
            <div className="h-20 w-20 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-semibold text-indigo-600">
                {getInitials(company.name)}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {company.name}
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div>
                  Added: {new Date(company.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* People at this Company */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            People at {company.name}
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({people.length})
            </span>
          </h2>
          
          {people.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No people from {company.name} in your CRM yet.
            </div>
          ) : (
            <div className="space-y-4">
              {people.map((person) => (
                <div
                  key={person.id}
                  className="group flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                >
                  <div
                    onClick={() => router.push(`/people/${person.id}`)}
                    className="flex items-center gap-4 flex-1 cursor-pointer"
                  >
                    {person.profile_image_url ? (
                      <img
                        src={person.profile_image_url}
                        alt={`${person.first_name} ${person.last_name}`}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-sm font-semibold text-indigo-600">
                          {person.first_name.charAt(0)}{person.last_name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {person.first_name} {person.last_name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {person.job_title || 'No title'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {person.email}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Added {new Date(person.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeletePerson(person.id, `${person.first_name} ${person.last_name}`, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-lg flex-shrink-0"
                    title="Delete person"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


