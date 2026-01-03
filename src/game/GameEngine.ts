import { Company } from './Company.js';
import { Market } from './Market.js';

export class GameEngine {
  private companies: Map<string, Company>;
  private tickCount: number;
  private market: Market;

  constructor() {
    this.companies = new Map();
    this.tickCount = 0;
    this.market = new Market();
  }

  /**
   * Add a company to the game
   */
  addCompany(id: string, name: string): Company {
    const company = new Company(id, name);
    this.companies.set(id, company);
    return company;
  }

  /**
   * Process one game tick for all companies and their facilities.
   * This processes production for the current tick, then advances to the next tick.
   */
  processTick(): void {
    // Process all facilities for all companies at the current tick
    this.companies.forEach(company => {
      company.facilities.forEach(facility => {
        facility.processTick(this.market);
      });
    });
    
    // Advance to next tick after processing
    this.tickCount++;
  }

  /**
   * Get current game state summary
   */
  getGameState(): string {
    const lines: string[] = [];
    lines.push(`\n=== Tick ${this.tickCount} ===`);
    
    this.companies.forEach(company => {
      lines.push(company.getSummary());
      company.facilities.forEach((facility, index) => {
        lines.push(`  Facility ${index + 1}: ${facility.getStatus()}`);
      });
    });
    
    return lines.join('\n');
  }

  /**
   * Get current tick count
   */
  getTickCount(): number {
    return this.tickCount;
  }

  /**
   * Get the market
   */
  getMarket(): Market {
    return this.market;
  }
}
