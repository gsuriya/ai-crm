/**
 * Type definitions for Company-related entities
 * Maps to existing Supabase schema
 */

export interface Company {
  id: string;
  name: string;
  domain?: string;
  stage?: string;
  sectors?: string[];
  location?: string;
  owner?: string;
  lastTouchAt?: string;
  relationshipScore?: number; // 0-100
  status?: string;
  email?: string;
  phone_number?: string;
  website?: string;
  industry?: string;
  description?: string;
  headquarters?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface Person {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  title?: string;
  function?: string; // Engineering, Product, Revenue, Finance, etc.
  seniority?: string; // Junior, Mid, Senior, VP, C-Level
  owner?: string;
  lastTouchAt?: string;
  threads?: number; // Email thread count
  strength?: number; // Relationship strength (freq × recency)
  tags?: string[];
  cadenceId?: string;
  email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Financials {
  rounds?: FundingRound[];
  metrics?: {
    arr?: number;
    growth?: number; // QoQ growth %
    margin?: number; // Gross margin %
    nrr?: number; // Net revenue retention %
    burn?: number;
    runway?: number; // months
    headcount?: number;
    acv?: number; // Average contract value
    payback?: number; // months
  };
}

export interface FundingRound {
  id: string;
  company_id: string;
  round_type: string; // pre-seed, seed, series-a, etc.
  size: number;
  date: string;
  lead?: string;
  participants?: string[];
  source?: string;
  confidence?: number; // 0-100
}

export interface ActivityItem {
  id: string;
  type: 'email' | 'meeting' | 'call' | 'note' | 'task' | 'upload';
  date: string;
  people?: Person[];
  summary?: string;
  body?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  company_id: string;
  created_at: string;
}

export interface Doc {
  id: string;
  company_id: string;
  type: 'deck' | 'pdf' | 'doc' | 'spreadsheet';
  title: string;
  source: 'email' | 'upload' | 'enrichment';
  createdAt: string;
  url: string;
  textIndexReady: boolean;
  uploaded_by?: string;
}

export interface Deal {
  id: string;
  company_id: string;
  name: string;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  amount?: number;
  probability?: number; // 0-100
  closeDate?: string;
  blockers?: string[];
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  company_id: string;
  contact_id?: string;
  scheduledAt: string;
  attendedAt?: string;
  type: 'email' | 'call' | 'in-person' | 'video';
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  owner?: string;
  cadenceId?: string;
  created_at: string;
}


