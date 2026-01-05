import { Company } from './Company.js';

/**
 * Admin/Cheat functions for development and testing
 * These are separate from the main game logic
 */
export class AdminFunctions {
  /**
   * Add balance to a company (cheat function)
   * @param company The company to add balance to
   * @param amount The amount to add
   */
  static addBalance(company: Company, amount: number): boolean {
    if (isNaN(amount) || amount < 0) {
      return false;
    }
    
    company.balance += amount;
    return true;
  }

  /**
   * Set balance to a specific amount (cheat function)
   * @param company The company to set balance for
   * @param amount The new balance amount
   */
  static setBalance(company: Company, amount: number): boolean {
    if (isNaN(amount) || amount < 0) {
      return false;
    }
    
    company.balance = amount;
    return true;
  }
}
