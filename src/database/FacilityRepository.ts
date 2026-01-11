import { supabase } from './supabase.ts';
import { FacilityBase } from '../game/FacilityBase.ts';
import { ProductionFacility } from '../game/ProductionFacility.ts';
import { StorageFacility } from '../game/StorageFacility.ts';
import { Office } from '../game/Office.ts';
import { RetailFacility } from '../game/RetailFacility.ts';
import { City } from '../game/City.ts';
import { RecipeRegistry } from '../game/RecipeRegistry.ts';

export interface FacilityRow {
  id: string;
  company_id: string;
  name: string;
  type: string;
  city_name: string;
  city_country: string;
  city_wealth: number;
  city_population: number;
  size: number;
  workers: number;
  effectivity: number;
  controlling_office_id: string | null;
  office_effectivity_multiplier: number;
  inventory: Record<string, number>;
  max_inventory_capacity: number | null;
  current_recipe: string | null;
  production_progress: number;
  retail_price: number | null; // Deprecated - keeping for DB compatibility
  retail_prices: Record<string, number> | null; // New field for multiple prices
  administrative_load: number;
}

export class FacilityRepository {
  /**
   * Save a facility to the database
   */
  static async save(facility: FacilityBase): Promise<{ success: boolean; error?: string }> {
    try {
      // Convert inventory Map to plain object
      const inventoryObj: Record<string, number> = {};
      if (facility.inventory) {
        facility.inventory.forEach((value, key) => {
          inventoryObj[key] = value;
        });
      }

      const facilityData: any = {
        id: facility.id,
        company_id: facility.ownerId,
        name: facility.name,
        type: facility.type,
        city_name: facility.city.name,
        city_country: facility.city.country,
        city_wealth: facility.city.wealth,
        city_population: facility.city.population,
        size: facility.size,
        workers: facility.workers,
        effectivity: facility.effectivity,
        controlling_office_id: facility.controllingOfficeId,
        office_effectivity_multiplier: facility.officeEffectivityMultiplier,
        inventory: inventoryObj,
        max_inventory_capacity: facility.cachedMaxInventoryCapacity,
        administrative_load: 0,
        updated_at: new Date().toISOString()
      };

      // Add type-specific fields
      if (facility instanceof ProductionFacility) {
        facilityData.current_recipe = facility.recipe?.name || null;
        facilityData.production_progress = facility.productionProgress;
      } else if (facility instanceof RetailFacility) {
        // Convert prices Map to plain object
        const pricesObj: Record<string, number> = {};
        facility.prices.forEach((value, key) => {
          pricesObj[key] = value;
        });
        facilityData.retail_price = null; // Deprecated field
        facilityData.retail_prices = pricesObj;
      } else if (facility instanceof Office) {
        facilityData.administrative_load = facility.administrativeLoad;
      }

      const { error } = await supabase
        .from('facilities')
        .upsert(facilityData, { onConflict: 'id' });

      if (error) throw error;

      return { success: true };
    } catch (err: any) {
      console.error('Failed to save facility:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Load facilities for a company
   */
  static async loadByCompanyId(companyId: string): Promise<FacilityBase[]> {
    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const facilities: FacilityBase[] = [];

      for (const row of data || []) {
        const city = new City(
          row.city_name,
          row.city_country,
          parseFloat(row.city_wealth),
          row.city_population
        );

        let facility: FacilityBase;

        // Determine facility type and create appropriate instance
        if (row.type === 'office') {
          facility = new Office(row.type, row.company_id, row.name, city);
        } else if (row.type === 'warehouse') {
          facility = new StorageFacility(row.type, row.company_id, row.name, city);
        } else if (row.type === 'retail') {
          facility = new RetailFacility(row.type, row.company_id, row.name, city);
          const retailFacility = facility as RetailFacility;
          // Restore prices Map
          if (row.retail_prices) {
            Object.entries(row.retail_prices as Record<string, number>).forEach(([key, value]) => {
              retailFacility.prices.set(key, value);
            });
          }
        } else {
          // Production facility (farm, mill, bakery, winery)
          facility = new ProductionFacility(row.type, row.company_id, row.name, city);
          const prodFacility = facility as ProductionFacility;
          if (row.current_recipe) {
            // Load recipe from RecipeRegistry
            const recipe = RecipeRegistry.get(row.current_recipe);
            if (recipe) {
              prodFacility.recipe = recipe;
              prodFacility.productionProgress = row.production_progress || 0;
            }
          }
        }

        // Restore common properties
        facility.id = row.id;
        facility.size = row.size;
        facility.workers = row.workers;
        facility.effectivity = parseFloat(row.effectivity);
        facility.controllingOfficeId = row.controlling_office_id;
        facility.officeEffectivityMultiplier = parseFloat(row.office_effectivity_multiplier);
        facility.cachedMaxInventoryCapacity = row.max_inventory_capacity;

        // Restore inventory
        if (facility.inventory && row.inventory) {
          facility.inventory.clear();
          Object.entries(row.inventory as Record<string, number>).forEach(([key, value]) => {
            facility.inventory!.set(key, value);
          });
        }

        // Restore office-specific data
        if (facility instanceof Office) {
          facility.administrativeLoad = parseFloat(row.administrative_load || '0');
        }

        facilities.push(facility);
      }

      return facilities;
    } catch (err: any) {
      console.error('Failed to load facilities:', err);
      return [];
    }
  }

  /**
   * Delete a facility
   */
  static async delete(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('facilities')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { success: true };
    } catch (err: any) {
      console.error('Failed to delete facility:', err);
      return { success: false, error: err.message };
    }
  }
}
