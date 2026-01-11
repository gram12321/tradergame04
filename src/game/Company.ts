import { FacilityBase } from './FacilityBase.ts';

export class Company {
  id: string;
  name: string;
  balance: number;
  facilities: FacilityBase[];

  constructor(id: string, name: string, initialBalance: number = 10000) {
    this.id = id;
    this.name = name;
    this.balance = initialBalance;
    this.facilities = [];
  }

  /**
   * Save company data to database
   */
  async save(): Promise<{ success: boolean; error?: string }> {
    // Dynamically import to avoid circular dependencies
    const { CompanyRepository } = await import('../database/CompanyRepository.js');
    const { FacilityRepository } = await import('../database/FacilityRepository.js');

    // Save company
    const companyResult = await CompanyRepository.save(this);
    if (!companyResult.success) {
      return companyResult;
    }

    // Save all facilities
    for (const facility of this.facilities) {
      const facilityResult = await FacilityRepository.save(facility);
      if (!facilityResult.success) {
        return facilityResult;
      }
    }

    return { success: true };
  }

  /**
   * Load company and its facilities from database
   */
  static async load(nameOrId: string): Promise<Company | null> {
    // Dynamically import to avoid circular dependencies
    const { CompanyRepository } = await import('../database/CompanyRepository.js');
    const { FacilityRepository } = await import('../database/FacilityRepository.js');

    // Try to load by name first, then by ID
    let company = await CompanyRepository.loadByName(nameOrId);
    if (!company) {
      company = await CompanyRepository.loadById(nameOrId);
    }

    if (!company) {
      return null;
    }

    // Load facilities
    company.facilities = await FacilityRepository.loadByCompanyId(company.id);

    return company;
  }

  /**
   * Get player summary for display
   */
  getSummary(): string {
    return `${this.name}: $${this.balance.toFixed(2)}, ${this.facilities.length} facilities`;
  }
}

