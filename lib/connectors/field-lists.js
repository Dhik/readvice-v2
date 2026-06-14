// Mappable fields per target table — the column-mapping builder renders one row
// per field. These are the writable, sheet-mappable columns only (id, tenantId,
// timestamps, and relations are excluded — they come from context/auto). Fields
// derived from the actual Prisma models; do not invent fields.
//
// Note: for order_sync, `platform` / `salesChannelId` are NOT here — they are
// supplied via the connector's staticValues (per CS1).
//
// `sku` / `productName` are line-item fields (NP1): the order_sync engine routes
// them to OrderItem, not Order. The connector keeps ONE flat columnMapping; the
// engine splits header / aggregate / line fields at write time.
export const FIELD_LISTS = {
  Order: ['orderId', 'orderDate', 'gmv', 'nett', 'qty', 'status',
          'customerName', 'customerUsername', 'skuCount',
          'sku', 'productName'],

  // product_sync (NP2a). Use 'decimal' transform for price/cost columns
  // (harga values use "." as a DECIMAL separator, not thousands). NB: Product has
  // no `type` / `combinationSku*` columns, so those sheet columns are not mappable.
  Product: ['sku', 'name', 'price', 'hargaCogs', 'hargaMarkup', 'hargaBatasBawah',
            'stock', 'platform', 'category'],

  Visit: ['date', 'platform', 'visits'],

  AdSpentShopee:      ['date', 'spent', 'impressions', 'clicks', 'orders', 'revenue', 'roas', 'cpc', 'ctr', 'adType'],
  AdSpentTiktok:      ['date', 'spent', 'impressions', 'clicks', 'conversions', 'revenue', 'roas', 'cpc', 'ctr', 'adName'],
  AdSpentMeta:        ['date', 'spent', 'impressions', 'clicks', 'conversions', 'revenue', 'roas', 'cpc', 'ctr', 'adsetName'],
  AdSpentLazada:      ['date', 'spent', 'clicks', 'orders', 'revenue', 'roas', 'cpc'],
  AdSpentSocialMedia: ['platform', 'date', 'amount'],
}
