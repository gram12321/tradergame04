import { supabase } from './supabase.js';
import { Company } from '../game/Company.js';

export interface CompanyRow {
  id: string;
  name: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export class CompanyRepository {
  /**
   * Save a company to the database
   */
  static async save(company: Company): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('companies')
        .upsert({
          id: company.id,
          name: company.name,
          balance: company.balance,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true };
    } catch (err: any) {
      console.error('Failed to save company:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Load a company by name
   */
  static async loadByName(name: string): Promise<Company | null> {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('name', name)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        throw error;
      }

      // Create company instance
      const company = new Company(data.id, data.name);
      company.balance = parseFloat(data.balance);

      return company;
    } catch (err: any) {
      console.error('Failed to load company:', err);
      return null;
    }
  }

  /**
   * Load a company by ID
   */
  static async loadById(id: string): Promise<Company | null> {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      const company = new Company(data.id, data.name);
      company.balance = parseFloat(data.balance);

      return company;
    } catch (err: any) {
      console.error('Failed to load company:', err);
      return null;
    }
  }

  /**
   * Load all companies
   */
  static async loadAll(): Promise<Company[]> {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      return data.map(row => {
        const company = new Company(row.id, row.name);
        company.balance = parseFloat(row.balance);
        return company;
      });
    } catch (err: any) {
      console.error('Failed to load companies:', err);
      return [];
    }
  }

  /**
   * Delete a company
   */
  static async delete(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { success: true };
    } catch (err: any) {
      console.error('Failed to delete company:', err);
      return { success: false, error: err.message };
    }
  }
  /**
   * Delete all companies and facilities
   */
  static async deleteAll(): Promise<{ success: boolean; error?: string }> {
    try {
      // First delete all facilities (foreign key dependency)
      // Use a filter that matches all UUIDs (length 36)
      const { error: fError } = await supabase
        .from('facilities')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (fError) throw fError;

      // Then delete all companies
      const { error: cError } = await supabase
        .from('companies')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (cError) throw cError;

      return { success: true };
    } catch (err: any) {
      console.error('Failed to wipe database:', err);
      return { success: false, error: err.message };
    }
  }
}
