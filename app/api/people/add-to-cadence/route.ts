import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email, firstName, lastName, company, cadenceId } = await request.json();

    if (!email || !firstName || !lastName || !company || !cadenceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let companyRecord;
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('*')
      .ilike('name', company)
      .single();

    if (existingCompany) {
      companyRecord = existingCompany;
    } else {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({ name: company })
        .select()
        .single();

      if (companyError) throw companyError;
      companyRecord = newCompany;
    }

    let contactRecord;
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (existingContact) {
      contactRecord = existingContact;
      await supabase
        .from('contacts')
        .update({
          first_name: firstName,
          last_name: lastName,
          company_id: companyRecord.id,
        })
        .eq('id', existingContact.id);
    } else {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          email: email.toLowerCase(),
          first_name: firstName,
          last_name: lastName,
          company_id: companyRecord.id,
          email_score: 100,
        })
        .select()
        .single();

      if (contactError) throw contactError;
      contactRecord = newContact;
    }

    const { data: companyCadence, error: cadenceError } = await supabase
      .from('company_cadences')
      .insert({
        company_id: companyRecord.id,
        contact_id: contactRecord.id,
        cadence_id: cadenceId,
        status: 'active',
      })
      .select()
      .single();

    if (cadenceError) throw cadenceError;

    return NextResponse.json({
      success: true,
      contact: contactRecord,
      company: companyRecord,
      companyCadence: companyCadence,
    });
  } catch (error: any) {
    console.error('Error adding to cadence:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
