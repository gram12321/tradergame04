
import { Company } from '../game/Company';
import { FacilityBase } from '../game/FacilityBase';
import { FacilityRegistry } from '../game/FacilityRegistry';
import { Office } from '../game/Office';
import { RecipeRegistry } from '../game/RecipeRegistry';
import { ProductionFacility } from '../game/ProductionFacility';
import { RetailFacility } from '../game/RetailFacility';
import { StorageFacility } from '../game/StorageFacility';
import { City } from '../game/City';

/**
 * Service class for managing facilities on behalf of a company.
 * Handles operations that modify both the company (balance) and the facility.
 */
export class FacilityManager {
      /**
       * Create a new facility for the company
       */
      static createFacility(company: Company, type: string, city: City): FacilityBase | null {
            const definition = FacilityRegistry.get(type);

            if (!definition) return null;
            if (company.balance < definition.cost) return null;

            const hasOfficeInCountry = Office.hasOfficeInCountry(company.facilities, city.country);
            if (definition.category !== 'office' && !hasOfficeInCountry) return null;
            if (definition.category === 'office' && hasOfficeInCountry) return null;

            const typeCount = company.facilities.filter(f => f.type === type).length;
            const facilityNumber = typeCount + 1;
            const facilityName = `${company.name} ${definition.name} #${facilityNumber}`;

            let facility: FacilityBase;
            switch (definition.category) {
                  case 'production':
                        facility = new ProductionFacility(type, company.id, facilityName, city);
                        break;
                  case 'storage':
                        facility = new StorageFacility(type, company.id, facilityName, city);
                        break;
                  case 'office':
                        facility = new Office(type, company.id, facilityName, city);
                        break;
                  case 'retail':
                        facility = new RetailFacility(type, company.id, facilityName, city);
                        break;
                  default:
                        facility = new ProductionFacility(type, company.id, facilityName, city);
            }

            if (definition.category !== 'office') {
                  const office = Office.getOfficeInCountry(company.facilities, city.country);
                  if (office) {
                        facility.controllingOfficeId = office.id;
                        office.addControlledFacility(facility.id);
                  }
            }

            if (facility instanceof ProductionFacility || facility instanceof StorageFacility || facility instanceof RetailFacility) {
                  facility.updateInventoryCapacityForTick();
            }

            if (facility) {
                  company.balance -= definition.cost;
                  company.facilities.push(facility);

                  if (definition.defaultRecipe && facility instanceof ProductionFacility) {
                        const recipe = RecipeRegistry.get(definition.defaultRecipe);
                        if (recipe) {
                              facility.setRecipe(recipe);
                        }
                  }
            }

            return facility;
      }

      /**
       * Destroy a facility
       */
      static destroyFacility(company: Company, facility: FacilityBase): boolean {
            const index = company.facilities.findIndex(f => f.id === facility.id);
            if (index === -1) return false;

            // Handle cleanup
            Office.onFacilityDestroyed(company.facilities, facility);

            // Remove facility
            company.facilities.splice(index, 1);
            return true;
      }

      /**
       * Upgrade a facility
       */
      static upgradeFacility(company: Company, facility: FacilityBase): boolean {
            if (facility.ownerId !== company.id) return false;

            const cost = facility.getUpgradeCost();
            if (company.balance < cost) return false;

            const actualCost = facility.upgradeSize();
            if (actualCost !== null) {
                  company.balance -= actualCost;
                  return true;
            }

            return false;
      }

      /**
       * Degrade a facility
       */
      static degradeFacility(company: Company, facility: FacilityBase): boolean {
            if (facility.ownerId !== company.id) return false;
            if (facility.size <= 1) return false;

            const refund = facility.degradeSize();
            if (refund !== null) {
                  company.balance += refund;
                  return true;
            }

            return false;
      }

      /**
       * Set worker count
        */
      static setFacilityWorkers(company: Company, facility: FacilityBase, workerCount: number): boolean {
            if (facility.ownerId !== company.id) return false;

            const hiringCost = facility.getHiringCost(workerCount);
            if (company.balance < hiringCost) return false;

            const success = facility.setWorkerCount(workerCount);
            if (success) {
                  company.balance -= hiringCost;
                  return true;
            }

            return false;
      }

      /**
       * Process wages for all facilities
       */
      static processWages(company: Company): number {
            let totalWages = 0;
            company.facilities.forEach(facility => {
                  totalWages += facility.getWagePerTick();
            });
            company.balance -= totalWages;
            return totalWages;
      }

      /**
       * Update administrative loads and effectivity
       * This is a "management" task so it fits here nicely
       */
      static updateFacilityInfrastructure(company: Company): void {
            Office.updateAdministrativeLoads(company.facilities);
            Office.updateOfficeEffectivity(company.facilities);
      }

      /**
       * Get total wages per tick for a company
       */
      static getTotalWages(company: Company): number {
            return company.facilities.reduce((sum, facility) => sum + facility.getWagePerTick(), 0);
      }
}
