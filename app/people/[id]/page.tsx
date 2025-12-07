"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, Linkedin, MapPin, Briefcase, GraduationCap, Building2, Edit, Plus } from "lucide-react";
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
  bio?: string;
  profile_image_url?: string;
  past_experience?: Array<{
    company: string;
    role: string;
    start_date?: string;
    end_date?: string;
    description?: string;
  }>;
  education?: Array<{
    school: string;
    degree?: string;
    field?: string;
    start_year?: string;
    end_year?: string;
  }>;
  created_at: string;
  updated_at: string;
}

interface EmailLog {
  id: string;
  direction: 'sent' | 'received';
  subject?: string;
  body?: string;
  from_email: string;
  to_email: string;
  sent_at?: string;
  received_at?: string;
  created_at: string;
}

export default function PersonDetailPage() {
  const params = useParams();
  const personId = params.id as string;
  const [person, setPerson] = useState<Person | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPerson = useCallback(async () => {
    if (!personId) return;
    
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [personResult, emailLogsResult] = await Promise.all([
        supabase
          .from("contacts")
          .select("*")
          .eq("id", personId)
          .single(),
        supabase
          .from("email_logs")
          .select("*")
          .or(`from_email.eq.${personId},to_email.eq.${personId}`)
          .order("sent_at", { ascending: false })
          .limit(10),
      ]);

      if (personResult.error) throw personResult.error;
      setPerson(personResult.data);

      if (emailLogsResult.data) {
        setEmailLogs(emailLogsResult.data);
      }
    } catch (error) {
      console.error("Error fetching person:", error);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    fetchPerson();
  }, [fetchPerson]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading person details...</div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="text-muted-foreground">Person not found</div>
        <Link href="/people">
          <Button variant="outline" className="mt-4">
            Back to People
          </Button>
        </Link>
      </div>
    );
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <Link href="/people">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to People
          </Button>
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {person.profile_image_url ? (
              <img
                src={person.profile_image_url}
                alt={`${person.first_name} ${person.last_name}`}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-2xl font-bold text-indigo-600">
                  {getInitials(person.first_name, person.last_name)}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {person.first_name} {person.last_name}
              </h1>
              {person.job_title && person.current_company && (
                <p className="text-lg text-gray-600 mt-1">
                  {person.job_title} at {person.current_company}
                </p>
              )}
              {person.location && (
                <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                  <MapPin className="h-4 w-4" />
                  <span>{person.location}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        {/* Contact Info */}
        <div className="flex items-center gap-4 mt-4">
          {person.email && (
            <a
              href={`mailto:${person.email}`}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600"
            >
              <Mail className="h-4 w-4" />
              {person.email}
            </a>
          )}
          {person.phone && (
            <a
              href={`tel:${person.phone}`}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600"
            >
              <Phone className="h-4 w-4" />
              {person.phone}
            </a>
          )}
          {person.linkedin_url && (
            <a
              href={person.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600"
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </a>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Experience & Education */}
            <div className="lg:col-span-2 space-y-6">
              {/* Bio */}
              {person.bio && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
                  <p className="text-sm text-gray-700 leading-relaxed">{person.bio}</p>
                </div>
              )}

              {/* Past Experience */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Experience
                  </h2>
                  <Button variant="ghost" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {person.past_experience && person.past_experience.length > 0 ? (
                  <div className="space-y-4">
                    {person.past_experience.map((exp, index) => (
                      <div key={index} className="flex gap-3">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-gray-600" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{exp.role}</h3>
                          <p className="text-sm text-gray-600">{exp.company}</p>
                          {(exp.start_date || exp.end_date) && (
                            <p className="text-xs text-gray-500 mt-1">
                              {exp.start_date || 'N/A'} - {exp.end_date || 'Present'}
                            </p>
                          )}
                          {exp.description && (
                            <p className="text-sm text-gray-700 mt-2">{exp.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No experience listed</p>
                )}
              </div>

              {/* Education */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    Education
                  </h2>
                  <Button variant="ghost" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {person.education && person.education.length > 0 ? (
                  <div className="space-y-4">
                    {person.education.map((edu, index) => (
                      <div key={index} className="flex gap-3">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
                            <GraduationCap className="h-5 w-5 text-gray-600" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{edu.school}</h3>
                          {edu.degree && edu.field && (
                            <p className="text-sm text-gray-600">
                              {edu.degree} in {edu.field}
                            </p>
                          )}
                          {(edu.start_year || edu.end_year) && (
                            <p className="text-xs text-gray-500 mt-1">
                              {edu.start_year || 'N/A'} - {edu.end_year || 'Present'}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No education listed</p>
                )}
              </div>
            </div>

            {/* Right Column - Activity */}
            <div className="space-y-6">
              {/* Email Activity */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
                {emailLogs.length > 0 ? (
                  <div className="space-y-3">
                    {emailLogs.map((log) => (
                      <div key={log.id} className="border-l-2 border-indigo-200 pl-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            log.direction === 'sent' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {log.direction === 'sent' ? 'Sent' : 'Received'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(log.sent_at || log.received_at || log.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {log.subject && (
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {log.subject}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No activity yet</p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Phone className="h-4 w-4 mr-2" />
                    Log Call
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
