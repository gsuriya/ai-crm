"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Building2, Users, MapPin, Calendar, DollarSign, Edit2, Save, X, FileText, Globe, Linkedin, Bell, Twitter } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface CompanyDetailsProps {
  companyId: string;
}

export function CompanyDetails({ companyId }: CompanyDetailsProps) {
  const router = useRouter();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [unreadEventCount, setUnreadEventCount] = useState(0);

  useEffect(() => {
    fetchCompanyDetails();
    fetchUnreadEventCount();
    
    // Refresh count periodically
    const interval = setInterval(fetchUnreadEventCount, 10000); // Poll every 10 seconds
    
    return () => clearInterval(interval);
  }, [companyId]);

  const fetchUnreadEventCount = async () => {
    try {
      const response = await fetch(`/api/monitoring/unread-count?companyId=${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setUnreadEventCount(data.count || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchCompanyDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

      if (error) throw error;
      setCompany(data);
      // Initialize editing values with current company data (raw values, not formatted)
      setEditingValues({
        name: data.name || "",
        description: data.description || "",
        website_url: data.website || "",
        linkedin_url: data.linkedin_url || "",
        twitter_handle: data.twitter_handle || "",
        employee_count: data.employee_count?.toString() || "",
        location: data.headquarters || "",
        founding_date: data.founding_date ? new Date(data.founding_date).getFullYear().toString() : "",
        funding_amount: data.funding_amount?.toString() || "",
      });
    } catch (error) {
      console.error("Error fetching company details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditField = (field: string) => {
    // Set the current value for editing
    let currentValue = "";
    switch (field) {
      case "name":
        currentValue = company.name || "";
        break;
      case "description":
        currentValue = company.description || "";
        break;
      case "website_url":
        currentValue = company.website || "";
        break;
      case "linkedin_url":
        currentValue = company.linkedin_url || "";
        break;
      case "twitter_handle":
        currentValue = (company as any).twitter_handle || "";
        break;
      case "employee_count":
        currentValue = company.employee_count?.toString() || "";
        break;
      case "location":
        currentValue = company.headquarters || "";
        break;
      case "founding_date":
        currentValue = company.founding_date ? new Date(company.founding_date).getFullYear().toString() : "";
        break;
      case "funding_amount":
        currentValue = company.funding_amount?.toString() || "";
        break;
    }
    setEditingValues((prev: any) => ({
      ...prev,
      [field]: currentValue,
    }));
    setEditingField(field);
  };

  const handleCancelField = () => {
    setEditingField(null);
  };

  const handleSaveField = async (field: string) => {
    try {
      setSaving(true);
      
      // Prepare update data for this specific field
      const updateData: any = {};
      const currentValue = editingValues[field];
      
      // Map field names to database column names
      const fieldToColumn: Record<string, string> = {
        name: 'name',
        description: 'description',
        website_url: 'website',
        linkedin_url: 'linkedin_url',
        employee_count: 'employee_count',
        location: 'headquarters',
        founding_date: 'founding_date',
        funding_amount: 'funding_amount',
      };
      
      const columnName = fieldToColumn[field];
      if (!columnName) {
        throw new Error(`Unknown field: ${field}`);
      }
      
      // Check if column exists in company object (means it exists in DB)
      // If field is description, linkedin_url, or twitter_handle and doesn't exist, skip update gracefully
      if ((field === 'description' || field === 'linkedin_url' || field === 'twitter_handle') && !company.hasOwnProperty(columnName)) {
        // Column doesn't exist - skip update but don't error
        setEditingField(null);
        alert(`The ${field.replace('_', ' ')} field is not available yet. Please add the column to your database first.\n\nRun this SQL in Supabase SQL Editor:\n\nALTER TABLE companies ADD COLUMN IF NOT EXISTS ${columnName} TEXT;\n\nThen refresh the page.`);
        return;
      }
      
      switch (field) {
        case "name":
          if (currentValue !== (company.name || "")) {
            updateData.name = currentValue || null;
          }
          break;
        case "description":
          if (currentValue !== (company.description || "")) {
            updateData.description = currentValue || null;
          }
          break;
        case "website_url":
          if (currentValue !== (company.website || "")) {
            updateData.website = currentValue || null;
          }
          break;
        case "linkedin_url":
          if (currentValue !== (company.linkedin_url || "")) {
            updateData.linkedin_url = currentValue || null;
          }
          break;
        case "twitter_handle":
          if (currentValue !== ((company as any).twitter_handle || "")) {
            updateData.twitter_handle = currentValue || null;
          }
          break;
        case "employee_count":
          if (currentValue !== (company.employee_count?.toString() || "")) {
            const employeeCount = currentValue ? parseInt(currentValue.toString().replace(/,/g, "")) : null;
            updateData.employee_count = employeeCount;
          }
          break;
        case "location":
          if (currentValue !== (company.headquarters || "")) {
            updateData.headquarters = currentValue || null;
          }
          break;
        case "founding_date":
          const currentYear = company.founding_date ? new Date(company.founding_date).getFullYear().toString() : "";
          if (currentValue !== currentYear) {
            const year = currentValue ? parseInt(currentValue) : null;
            if (year) {
              updateData.founding_date = new Date(year, 0, 1).toISOString();
            } else {
              updateData.founding_date = null;
            }
          }
          break;
        case "funding_amount":
          if (currentValue !== (company.funding_amount?.toString() || "")) {
            // Parse funding amount - handle various formats
            const fundingStr = currentValue.toString().trim();
            if (!fundingStr || fundingStr === "Not disclosed") {
              updateData.funding_amount = null;
            } else {
              // Remove $ and commas, handle K/M suffixes
              let cleanAmount = fundingStr.replace(/[$,]/g, "").toLowerCase();
              let multiplier = 1;
              
              if (cleanAmount.includes("k")) {
                multiplier = 1000;
                cleanAmount = cleanAmount.replace("k", "");
              } else if (cleanAmount.includes("m")) {
                multiplier = 1000000;
                cleanAmount = cleanAmount.replace("m", "");
              }
              
              const parsedAmount = parseFloat(cleanAmount);
              updateData.funding_amount = isNaN(parsedAmount) ? null : parsedAmount * multiplier;
            }
          }
          break;
      }
      
      // Only update if there are changes
      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from("companies")
          .update(updateData)
          .eq("id", companyId);
        
        if (error) {
          console.error("Supabase error:", error);
          // Check if error is about missing column
          if (error.message?.includes("Could not find") && error.message?.includes("column") || 
              error.message?.includes("column") && error.message?.includes("does not exist")) {
            const missingColumn = Object.keys(updateData)[0];
            const sql = `ALTER TABLE companies ADD COLUMN IF NOT EXISTS ${missingColumn} TEXT;`;
            
            // Show clear error with copy-paste SQL
            const errorMsg = `❌ Column "${missingColumn}" doesn't exist in database.\n\n` +
              `📋 Copy this SQL and run it in Supabase:\n\n` +
              `${sql}\n\n` +
              `🔧 Steps:\n` +
              `1. Open https://supabase.com/dashboard\n` +
              `2. Select your project\n` +
              `3. Go to "SQL Editor" (left sidebar)\n` +
              `4. Paste the SQL above\n` +
              `5. Click "Run" (or press Cmd/Ctrl+Enter)\n` +
              `6. Refresh this page`;
            
            alert(errorMsg);
            throw new Error(errorMsg);
          }
          throw error;
        }
        
        // Refresh company data
        await fetchCompanyDetails();
        
        // Dispatch custom event to notify other components to refresh
        window.dispatchEvent(new CustomEvent('companyUpdated', { 
          detail: { companyId, field } 
        }));
      }
      
      setEditingField(null);
    } catch (error: any) {
      console.error("Error saving company details:", error);
      alert(`Failed to save: ${error.message || "Please try again."}`);
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setEditingValues((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return "Not disclosed";
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Not available";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return "Not available";
    }
  };

  const formatYear = (dateString: string | null | undefined) => {
    if (!dateString) return "Not available";
    try {
      const date = new Date(dateString);
      return date.getFullYear().toString();
    } catch {
      return "Not available";
    }
  };

  if (loading) {
    return (
      <Card className="rounded-2xl shadow-sm border border-border p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (!company) {
    return null;
  }

  const getFieldValue = (field: string) => {
    switch (field) {
      case "name":
        return company.name || "Not available";
      case "description":
        return company.description || "No description";
      case "website_url":
        return company.website || "No website";
      case "linkedin_url":
        return company.linkedin_url || "No LinkedIn";
      case "twitter_handle":
        return (company as any).twitter_handle ? `@${(company as any).twitter_handle.replace('@', '')}` : "No Twitter";
      case "employee_count":
        return company.employee_count 
          ? `${company.employee_count.toLocaleString()} employees`
          : "Not available";
      case "location":
        return company.headquarters || "Not available";
      case "founding_date":
        return formatYear(company.founding_date);
      case "funding_amount":
        return formatCurrency(company.funding_amount);
      default:
        return "";
    }
  };

  const getInputValue = (field: string) => {
    return editingValues[field] || "";
  };

  // Only show fields that exist in the database (to avoid errors)
  const availableFields = [
    {
      key: "name",
      label: "Company Name",
      icon: Building2,
      inputType: "text",
      placeholder: "Enter company name",
      dbColumn: "name",
    },
    {
      key: "description",
      label: "Description",
      icon: FileText,
      inputType: "textarea",
      placeholder: "Enter company description",
      dbColumn: "description",
    },
    {
      key: "website_url",
      label: "Website URL",
      icon: Globe,
      inputType: "text",
      placeholder: "https://example.com",
      dbColumn: "website",
    },
    {
      key: "linkedin_url",
      label: "LinkedIn URL",
      icon: Linkedin,
      inputType: "text",
      placeholder: "https://linkedin.com/company/example",
      dbColumn: "linkedin_url",
    },
    {
      key: "twitter_handle",
      label: "Twitter Handle",
      icon: Twitter,
      inputType: "text",
      placeholder: "@companyname or companyname",
      dbColumn: "twitter_handle",
    },
  ];

  // Filter to only show fields that exist in the database
  const details = [
    ...availableFields.filter(field => {
      // Always show name and website (they always exist)
      if (field.key === 'name' || field.key === 'website_url') return true;
      // For description and linkedin_url, only show if column exists in company object
      return field.dbColumn in company;
    }),
    {
      key: "employee_count",
      label: "Employee Count",
      icon: Users,
      inputType: "number",
      placeholder: "Enter number of employees",
    },
    {
      key: "location",
      label: "Location",
      icon: MapPin,
      inputType: "text",
      placeholder: "Enter location",
    },
    {
      key: "founding_date",
      label: "Founded",
      icon: Calendar,
      inputType: "number",
      placeholder: "Enter year (e.g., 2020)",
    },
    {
      key: "funding_amount",
      label: "Funding Raised",
      icon: DollarSign,
      inputType: "text",
      placeholder: "Enter amount (e.g., 1000000 or 1M)",
    },
  ];

  return (
    <Card className="rounded-2xl shadow-sm border border-border p-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg font-semibold text-foreground">
              Company Details
            </CardTitle>
          </div>
          {unreadEventCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/companies/${companyId}/events`)}
              className="relative h-8 px-3"
            >
              <Bell className="h-4 w-4" />
              <span className="ml-1.5 flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold">
                {unreadEventCount > 99 ? '99+' : unreadEventCount}
              </span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {details.map((detail) => {
          const Icon = detail.icon;
          const isFieldEditing = editingField === detail.key;
          return (
            <div key={detail.key} className="flex items-start gap-3 group">
              <div className="mt-0.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">
                  {detail.label}
                </p>
                {isFieldEditing ? (
                  <div className={`flex gap-2 ${detail.inputType === 'textarea' ? 'flex-col' : 'items-center'}`}>
                    {detail.inputType === 'textarea' ? (
                      <Textarea
                        value={getInputValue(detail.key)}
                        onChange={(e) => handleFieldChange(detail.key, e.target.value)}
                        placeholder={detail.placeholder}
                        className="text-sm flex-1 min-h-[80px]"
                        autoFocus
                      />
                    ) : (
                      <Input
                        type={detail.inputType}
                        value={getInputValue(detail.key)}
                        onChange={(e) => handleFieldChange(detail.key, e.target.value)}
                        placeholder={detail.placeholder}
                        className="h-8 text-sm flex-1"
                        autoFocus
                      />
                    )}
                    <div className={`flex gap-2 ${detail.inputType === 'textarea' ? 'justify-end' : ''}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelField}
                        className="h-8 px-2"
                        disabled={saving}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleSaveField(detail.key)}
                        className="h-8 px-2"
                        disabled={saving}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    {detail.inputType === 'textarea' ? (
                      <p className="text-sm text-foreground flex-1 whitespace-pre-wrap leading-relaxed">
                        {getFieldValue(detail.key)}
                      </p>
                    ) : detail.key === 'website_url' || detail.key === 'linkedin_url' ? (
                      <div className="flex-1">
                        {company[detail.key === 'website_url' ? 'website' : 'linkedin_url'] ? (
                          <a
                            href={company[detail.key === 'website_url' ? 'website' : 'linkedin_url']}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary hover:underline flex-1"
                          >
                            {getFieldValue(detail.key)}
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-foreground flex-1">
                            {getFieldValue(detail.key)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-foreground flex-1">
                        {getFieldValue(detail.key)}
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditField(detail.key)}
                      className="h-7 px-2 flex-shrink-0"
                      disabled={saving || editingField !== null}
                      title="Edit"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

