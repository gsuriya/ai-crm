/**
 * Type definitions for Pipeline metrics and analytics
 */

export interface PipelineMetrics {
  bookedMeetings30d: number;
  bookedMeetings30dPrev: number; // Previous period for comparison
  responseRate: number; // Percentage
  followUpMeetingsNext14d: number;
  noShowRate: number; // Percentage
  pipelineVelocityDays: number; // Average days from first meeting → deal stage
  voiceCallConnectRate: number; // Percentage
  voiceDecisionMakerRate: number; // Percentage
  voiceDropoffRate: number; // Percentage
}

export interface FunnelStage {
  stage: 'outreach' | 'meeting' | 'follow-up' | 'deal' | 'closed';
  count: number;
  conversionRate?: number; // Percentage from previous stage
}

export interface MeetingTrend {
  date: string;
  booked: number;
  attended: number;
  noShow: number;
}

export interface PipelineInsight {
  id: string;
  type: 'cadence-performance' | 'call-optimization' | 'follow-up-timing' | 'conversion-rate';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  actionable: boolean;
  actionLabel?: string;
  benchmark?: number;
  current?: number;
}


