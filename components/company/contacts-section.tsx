"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { User, Plus, Mail, Phone, Workflow, X, Edit, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Contact {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  position: string | null;
  created_at: string;
  updated_at: string;
}

interface Cadence {
  id: string;
  name: string;
}

interface CompanyCadence {
  id: string;
  company_id: string;
  cadence_id: string;
  contact_id: string | null;
  status: string;
  metadata: any;
}

export function ContactsSection({ companyId, company }: { companyId: string; company: any }) {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [cadences, setCadences] = useState<Cadence[]>([]);
  const [companyCadences, setCompanyCadences] = useState<CompanyCadence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");

  const fetchContacts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error("Error fetching contacts:", error);
    }
  }, [companyId]);

  const fetchCadences = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("cadences")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;
      setCadences(data || []);
    } catch (error) {
      console.error("Error fetching cadences:", error);
    }
  }, []);

  const fetchCompanyCadences = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("company_cadences")
        .select("*")
        .eq("company_id", companyId);

      if (error) throw error;
      setCompanyCadences(data || []);
    } catch (error) {
      console.error("Error fetching company cadences:", error);
    }
  }, [companyId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchContacts(), fetchCadences(), fetchCompanyCadences()]);
      setLoading(false);
    };
    loadData();
  }, [fetchContacts, fetchCadences, fetchCompanyCadences]);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setPosition("");
    setEditingContact(null);
  };

  const handleAddContact = async () => {
    if (!firstName || !lastName || !email) {
      alert("Please fill in first name, last name, and email");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          company_id: companyId,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone || null,
          position: position || null,
        })
        .select()
        .single();

      if (error) throw error;

      setContacts([data, ...contacts]);
      resetForm();
      setShowAddContactModal(false);
    } catch (error: any) {
      console.error("Error adding contact:", error);
      alert(`Error adding contact: ${error.message}`);
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setFirstName(contact.first_name);
    setLastName(contact.last_name);
    setEmail(contact.email);
    setPhone(contact.phone || "");
    setPosition(contact.position || "");
    setShowAddContactModal(true);
  };

  const handleUpdateContact = async () => {
    if (!editingContact || !firstName || !lastName || !email) {
      alert("Please fill in first name, last name, and email");
      return;
    }

    try {
      const { error } = await supabase
        .from("contacts")
        .update({
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone || null,
          position: position || null,
        })
        .eq("id", editingContact.id);

      if (error) throw error;

      await fetchContacts();
      resetForm();
      setShowAddContactModal(false);
    } catch (error: any) {
      console.error("Error updating contact:", error);
      alert(`Error updating contact: ${error.message}`);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contactId);

      if (error) throw error;

      await fetchContacts();
      await fetchCompanyCadences();
    } catch (error: any) {
      console.error("Error deleting contact:", error);
      alert(`Error deleting contact: ${error.message}`);
    }
  };

  const getContactCadence = (contactId: string) => {
    const companyCadence = companyCadences.find(
      (cc) => cc.contact_id === contactId && cc.status !== "completed"
    );
    if (!companyCadence) return null;
    return cadences.find((c) => c.id === companyCadence.cadence_id);
  };

  const handleAddToCadence = async (contactId: string, cadenceId: string) => {
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;

      // Check if company is already in this cadence
      const existing = companyCadences.find(
        (cc) => cc.cadence_id === cadenceId && cc.company_id === companyId
      );

      if (existing) {
        // Update existing to use this contact
        const { error } = await supabase
          .from("company_cadences")
          .update({
            contact_id: contact.id,
            metadata: {
              ...existing.metadata,
              contact_id: contact.id,
            },
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Create new company_cadence entry
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase.from("company_cadences").insert({
          company_id: companyId,
          cadence_id: cadenceId,
          contact_id: contact.id,
          status: "active",
          metadata: {
            contact_id: contact.id,
            user_id: user.id,
          },
        });

        if (error) throw error;
      }

      await fetchCompanyCadences();
      
      // Navigate to the cadence workflow page
      router.push(`/cadences?edit=${cadenceId}&companyId=${companyId}`);
    } catch (error: any) {
      console.error("Error adding to cadence:", error);
      alert(`Error adding to cadence: ${error.message}`);
    }
  };

  const handleRemoveFromCadence = async (contactId: string) => {
    try {
      const companyCadence = companyCadences.find(
        (cc) => cc.contact_id === contactId && cc.status !== "completed"
      );

      if (companyCadence) {
        const { error } = await supabase
          .from("company_cadences")
          .update({
            contact_id: null,
            metadata: {
              ...companyCadence.metadata,
              contact_id: null,
            },
          })
          .eq("id", companyCadence.id);

        if (error) throw error;
        await fetchCompanyCadences();
      }
    } catch (error: any) {
      console.error("Error removing from cadence:", error);
      alert(`Error removing from cadence: ${error.message}`);
    }
  };


  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-sm text-gray-500">Loading contacts...</div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <User className="h-4 w-4" />
            Contacts
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              resetForm();
              setShowAddContactModal(true);
            }}
            className="text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Contact
          </Button>
        </div>

        {contacts.length === 0 ? (
          <p className="text-xs text-gray-500">No contacts yet</p>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => {
              const cadence = getContactCadence(contact.id);
              return (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {contact.first_name} {contact.last_name}
                      </span>
                      {contact.position && (
                        <span className="text-xs text-gray-500">• {contact.position}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      {contact.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </div>
                      )}
                    </div>
                    {cadence && (
                      <div className="flex items-center gap-2 mt-2">
                        <Workflow className="h-3 w-3 text-blue-600" />
                        <span className="text-xs text-blue-600 font-medium">{cadence.name}</span>
                        <span className="text-xs text-gray-500">• Active</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 px-3 text-xs font-medium">
                          {cadence ? (
                            <>
                              <Workflow className="h-3.5 w-3.5 mr-1.5" />
                              {cadence.name}
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5 mr-1.5" />
                              Add to Cadence
                            </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[200px]">
                        {cadence ? (
                          <>
                            {cadences.map((c) => (
                              <DropdownMenuItem
                                key={c.id}
                                onClick={() => handleAddToCadence(contact.id, c.id)}
                                className={c.id === cadence.id ? "bg-blue-50" : ""}
                              >
                                {c.name} {c.id === cadence.id && "✓"}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuItem
                              onClick={() => handleRemoveFromCadence(contact.id)}
                              className="text-red-600 border-t mt-1 pt-1"
                            >
                              Remove from Cadence
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            {cadences.length === 0 ? (
                              <DropdownMenuItem disabled>
                                No cadences available
                              </DropdownMenuItem>
                            ) : (
                              cadences.map((c) => (
                                <DropdownMenuItem
                                  key={c.id}
                                  onClick={() => handleAddToCadence(contact.id, c.id)}
                                >
                                  {c.name}
                                </DropdownMenuItem>
                              ))
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleEditContact(contact)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteContact(contact.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Contact Modal */}
      <Dialog open={showAddContactModal} onOpenChange={setShowAddContactModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? "Edit Contact" : "Add Contact"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
              />
            </div>
            <div>
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="CEO"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddContactModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={editingContact ? handleUpdateContact : handleAddContact}
              disabled={!firstName || !lastName || !email}
            >
              {editingContact ? "Update" : "Add"} Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}

