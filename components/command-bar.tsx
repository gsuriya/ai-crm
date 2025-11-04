"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from "@/components/ui/dialog";
import { Search, Building2, Users, FileText, Plus, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Company, Person } from "@/lib/types/company";

interface CommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandBar({ open, onOpenChange }: CommandBarProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }

    // Fetch companies and people for search
    const fetchData = async () => {
      setLoading(true);
      try {
        const [companiesRes, peopleRes] = await Promise.all([
          supabase.from("companies").select("id, name, domain").limit(10),
          supabase.from("contacts").select("id, first_name, last_name, company_id").limit(10),
        ]);

        if (companiesRes.data) setCompanies(companiesRes.data as Company[]);
        if (peopleRes.data) setPeople(peopleRes.data as Person[]);
      } catch (error) {
        console.error("Error fetching data for command bar:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open]);

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPeople = people.filter(
    (p) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 max-w-2xl border-0 shadow-none">
        <Command className="rounded-lg border shadow-md bg-background" shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Search companies, people, or ask AI..."
              value={search}
              onValueChange={setSearch}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-1">
            {loading && (
              <Command.Loading>
                <div className="p-4 text-sm text-muted-foreground">Loading...</div>
              </Command.Loading>
            )}

            <Command.Empty>No results found.</Command.Empty>

            {filteredCompanies.length > 0 && (
              <Command.Group heading="Companies">
                {filteredCompanies.map((company) => (
                  <Command.Item
                    key={company.id}
                    value={company.name}
                    onSelect={() => {
                      router.push(`/companies/${company.id}/overview`);
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent"
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{company.name}</span>
                    {company.domain && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {company.domain}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {filteredPeople.length > 0 && (
              <Command.Group heading="People">
                {filteredPeople.map((person) => (
                  <Command.Item
                    key={person.id}
                    value={`${person.first_name} ${person.last_name}`}
                    onSelect={() => {
                      router.push(`/companies/${person.company_id}/people`);
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent"
                  >
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {person.first_name} {person.last_name}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Quick Actions">
              <Command.Item
                onSelect={() => {
                  router.push("/companies/new");
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent"
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span>New Company</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  // TODO: Implement "Ask AI" functionality
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent"
              >
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span>Ask AI</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

