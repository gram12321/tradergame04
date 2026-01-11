import { supabase } from './supabase.ts';

export interface GameStateRow {
  id: string;
  tick_count: number;
  created_at: string;
  updated_at: string;
}

export class GameStateRepository {
  /**
   * Get current tick count
   */
  static async getTickCount(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('game_state')
        .select('tick_count')
        .eq('id', 'global')
        .single();

      if (error) throw error;

      return data.tick_count;
    } catch (err: any) {
      console.error('Failed to get tick count:', err);
      return 0;
    }
  }

  /**
   * Increment tick count
   */
  static async incrementTick(): Promise<{ success: boolean; newTick: number; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('increment_tick');

      if (error) {
        // If function doesn't exist, do it manually
        const currentTick = await this.getTickCount();
        const newTick = currentTick + 1;

        const { error: updateError } = await supabase
          .from('game_state')
          .update({
            tick_count: newTick,
            updated_at: new Date().toISOString()
          })
          .eq('id', 'global');

        if (updateError) throw updateError;

        return { success: true, newTick };
      }

      return { success: true, newTick: data };
    } catch (err: any) {
      console.error('Failed to increment tick:', err);
      return { success: false, newTick: 0, error: err.message };
    }
  }

  /**
   * Set tick count (for testing/admin)
   */
  static async setTickCount(tickCount: number): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('game_state')
        .update({
          tick_count: tickCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'global');

      if (error) throw error;

      return { success: true };
    } catch (err: any) {
      console.error('Failed to set tick count:', err);
      return { success: false, error: err.message };
    }
  }
}
