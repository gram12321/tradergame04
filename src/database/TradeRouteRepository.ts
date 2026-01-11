import { supabase } from './supabase.js';
import { SellOffer, TradeRoute } from '../game/ContractSystem.js';

export class TradeRouteRepository {
      /**
       * Save all sell offers
       */
      static async saveSellOffers(offers: SellOffer[]): Promise<{ success: boolean; error?: string }> {
            try {
                  console.log(`   TradeRouteRepository: Saving ${offers.length} sell offers...`);
                  if (offers.length === 0) {
                        await supabase.from('sell_offers').delete().neq('id', 'none');
                        return { success: true };
                  }

                  const rows = offers.map(o => ({
                        id: o.id,
                        seller_id: o.sellerId,
                        seller_name: o.sellerName,
                        seller_facility_id: o.sellerFacilityId,
                        seller_facility_name: o.sellerFacilityName,
                        resource: o.resource,
                        price_per_unit: o.pricePerUnit,
                        amount_available: o.amountAvailable,
                        amount_in_stock: o.amountInStock
                  }));

                  // Delete existing and insert new
                  await supabase.from('sell_offers').delete().neq('id', 'none');
                  const { error } = await supabase.from('sell_offers').insert(rows);

                  if (error) {
                        console.error('   ❌ Supabase insert error (sell_offers):', error);
                        throw error;
                  }
                  console.log('   ✅ Sell offers saved to DB');

                  return { success: true };
            } catch (err: any) {
                  console.error('Failed to save sell offers:', err);
                  return { success: false, error: err.message };
            }
      }

      /**
       * Load all sell offers
       */
      static async loadSellOffers(): Promise<SellOffer[]> {
            try {
                  const { data, error } = await supabase.from('sell_offers').select('*');

                  if (error) throw error;

                  return (data || []).map(row => ({
                        id: row.id,
                        sellerId: row.seller_id,
                        sellerName: row.seller_name,
                        sellerFacilityId: row.seller_facility_id,
                        sellerFacilityName: row.seller_facility_name,
                        resource: row.resource,
                        pricePerUnit: row.price_per_unit,
                        amountAvailable: row.amount_available,
                        amountInStock: row.amount_in_stock
                  }));
            } catch (err) {
                  console.error('Failed to load sell offers:', err);
                  return [];
            }
      }

      /**
       * Save all trade routes
       */
      static async saveTradeRoutes(routes: TradeRoute[]): Promise<{ success: boolean; error?: string }> {
            try {
                  console.log(`   TradeRouteRepository: Saving ${routes.length} trade routes...`);
                  // Clear existing trade routes first
                  await supabase.from('trade_routes').delete().neq('id', 'none');

                  if (routes.length === 0) return { success: true };

                  const rows = routes.map(r => ({
                        id: r.id,
                        seller_id: r.sellerId,
                        seller_name: r.sellerName,
                        seller_facility_id: r.sellerFacilityId,
                        seller_facility_name: r.sellerFacilityName,
                        buyer_id: r.buyerId,
                        buyer_name: r.buyerName,
                        buyer_facility_id: r.buyerFacilityId,
                        buyer_facility_name: r.buyerFacilityName,
                        sell_offer_id: r.sellOfferId || null,
                        resource: r.resource,
                        amount_per_tick: r.amountPerTick,
                        price_per_unit: r.pricePerUnit,
                        total_price: r.totalPrice,
                        last_failed_tick: r.lastFailedTick,
                        created_at_tick: r.createdAt,
                        is_internal: r.isInternal
                  }));

                  const { error } = await supabase.from('trade_routes').insert(rows);

                  if (error) {
                        console.error('   ❌ Supabase insert error (trade_routes):', error);
                        throw error;
                  }
                  console.log('   ✅ Trade routes saved to DB');

                  return { success: true };
            } catch (err: any) {
                  console.error('Failed to save trade routes:', err);
                  return { success: false, error: err.message };
            }
      }

      /**
       * Load all trade routes
       */
      static async loadTradeRoutes(): Promise<TradeRoute[]> {
            try {
                  const { data, error } = await supabase.from('trade_routes').select('*').order('created_at_tick', { ascending: true });

                  if (error) throw error;

                  return (data || []).map(row => ({
                        id: row.id,
                        sellerId: row.seller_id,
                        sellerName: row.seller_name,
                        sellerFacilityId: row.seller_facility_id,
                        sellerFacilityName: row.seller_facility_name,
                        buyerId: row.buyer_id,
                        buyerName: row.buyer_name,
                        buyerFacilityId: row.buyer_facility_id,
                        buyerFacilityName: row.buyer_facility_name,
                        sellOfferId: row.sell_offer_id || undefined,
                        resource: row.resource,
                        amountPerTick: row.amount_per_tick,
                        pricePerUnit: row.price_per_unit,
                        totalPrice: row.total_price,
                        lastFailedTick: row.last_failed_tick,
                        createdAt: row.created_at_tick,
                        isInternal: row.is_internal
                  }));
            } catch (err) {
                  console.error('Failed to load trade routes:', err);
                  return [];
            }
      }
}
