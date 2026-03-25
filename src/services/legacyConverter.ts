/**
 * Legacy Converter Service
 * Translates the logic from convert_shopify.py into TypeScript.
 * This handles the hierarchical structure of supplier spreadsheets (TOUGHER).
 */

export interface ShopifyRow {
  Handle: string;
  Title: string;
  "Body (HTML)": string;
  Vendor: string;
  "Product Category": string;
  Type: string;
  Tags: string;
  Published: string;
  "Option1 Name": string;
  "Option1 Value": string;
  "Variant SKU": string;
  "Variant Grams": string;
  "Variant Inventory Tracker": string;
  "Variant Inventory Qty": string;
  "Variant Inventory Policy": string;
  "Variant Fulfillment Service": string;
  "Variant Price": string | number;
  "Variant Requires Shipping": string;
  "Variant Taxable": string;
  "Variant Barcode": string;
  "Image Src": string;
  "Image Position": string;
  "Gift Card": string;
  "Google Shopping / Google Product Category": string;
  "Google Shopping / Gender": string;
  "Google Shopping / Age Group": string;
  "Google Shopping / Condition": string;
  "Google Shopping / Custom Product": string;
  "Google: Custom Product (product.metafields.mm-google-shopping.custom_product)": string;
  "Variant Weight Unit"?: string;
  "Variant Tax Code"?: string;
  "Cost per item": string | number;
  Status: string;
}

function formatPrice(price: any): string | number {
  if (price === null || price === undefined || price === "") return "";
  try {
    let val = String(price);
    val = val.replace(/R/g, '').replace(/,/g, '').trim();
    const num = parseFloat(val);
    return isNaN(num) ? "" : Math.round(num * 100) / 100;
  } catch {
    return "";
  }
}

export function convertLegacyData(rows: any[][]): ShopifyRow[] {
  const result: ShopifyRow[] = [];
  
  let currentBrand = "";
  let currentCategory = "";

  // Process rows
  rows.forEach((row, index) => {
    // Skip header block (first 6 rows in Python script)
    if (index < 6) return;

    const col0 = row[0];
    const col1 = row[1];
    const priceRsp = row[2];
    const priceDealer = row[3];

    // Check for hierarchy headers
    // If col0 is not null, doesn't start with '0', col1 is null, priceRsp is null
    if (col0 !== null && col0 !== undefined && String(col0).trim() !== "" && 
        !String(col0).startsWith('0') && 
        (col1 === null || col1 === undefined || String(col1).trim() === "") && 
        (priceRsp === null || priceRsp === undefined || String(priceRsp).trim() === "")) {
      
      const val = String(col0).trim();
      const upperVal = val.toUpperCase();
      
      // Brand detection
      if (upperVal === val && 
          !upperVal.includes("COVERS") && 
          !upperVal.includes("ACCESSORIES") && 
          !upperVal.includes("MATS")) {
        currentBrand = val;
      } else {
        // Category detection
        if (upperVal.includes("ACCESSORIES") || upperVal.includes("COVERS") || upperVal.includes("MATS")) {
          currentCategory = val
            .replace(/ \(incl Delivery\)/g, "")
            .replace(/ \(excl Delivery\)/g, "")
            .replace(/ \(incl Delivery & Duffel Bag\)/g, "")
            .trim();
        }
      }
      return; // hierarchy header handled
    }

    // Model header detection
    // If col0 is null, col1 is not null, priceRsp is null
    if ((col0 === null || col0 === undefined || String(col0).trim() === "") && 
        (col1 !== null && col1 !== undefined && String(col1).trim() !== "") && 
        (priceRsp === null || priceRsp === undefined || String(priceRsp).trim() === "")) {
      
      // Model header handled (currentModel removed to fix lint as it was unused)
      return;
    }

    // Data row detection
    // If col0, col1, priceRsp are not null
    if (col0 !== null && col0 !== undefined && String(col0).trim() !== "" && 
        col1 !== null && col1 !== undefined && String(col1).trim() !== "" && 
        priceRsp !== null && priceRsp !== undefined && String(priceRsp).trim() !== "") {
      
      const partNo = String(col0).trim();
      if (partNo === 'Part No' || partNo === '0') return;

      const desc = String(col1).trim();
      
      // Default type from part prefix if category is missing
      let itemType = currentCategory;
      if (!itemType) {
        if (partNo.startsWith('SC')) itemType = "SEAT COVERS";
        else if (partNo.startsWith('DC')) itemType = "DASH COVERS";
        else if (partNo.startsWith('FM')) itemType = "FLOOR MATS";
        else if (partNo.startsWith('A-')) itemType = "ACCESSORIES";
      }

      let longTitle = desc;
      if (currentBrand && !longTitle.toUpperCase().includes(currentBrand.toUpperCase())) {
        longTitle = `${currentBrand} - ${longTitle}`;
      }

      let shortTitle = longTitle.split(";")[0].trim();
      if (itemType && !shortTitle.toUpperCase().includes(itemType.toUpperCase())) {
        shortTitle = `${shortTitle} - ${itemType}`;
      }

      const shopifyRow: ShopifyRow = {
        "Handle": partNo.toLowerCase(),
        "Title": shortTitle,
        "Body (HTML)": `<p>${longTitle}</p>`,
        "Vendor": "TOUGHER",
        "Product Category": "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Frame & Body Parts",
        "Type": itemType,
        "Tags": itemType,
        "Published": "TRUE",
        "Option1 Name": "Title",
        "Option1 Value": "Default Title",
        "Variant SKU": partNo,
        "Variant Grams": "0",
        "Variant Inventory Tracker": "shopify",
        "Variant Inventory Qty": "0",
        "Variant Inventory Policy": "continue",
        "Variant Fulfillment Service": "manual",
        "Variant Price": formatPrice(priceRsp),
        "Variant Requires Shipping": "TRUE",
        "Variant Taxable": "FALSE",
        "Variant Barcode": partNo,
        "Image Src": "",
        "Image Position": "1",
        "Gift Card": "FALSE",
        "Google Shopping / Google Product Category": "8227",
        "Google Shopping / Gender": "Unisex",
        "Google Shopping / Age Group": "Adult",
        "Google Shopping / Condition": "new",
        "Google Shopping / Custom Product": "FALSE",
        "Google: Custom Product (product.metafields.mm-google-shopping.custom_product)": "g",
        "Cost per item": formatPrice(priceDealer),
        "Status": "active"
      };

      result.push(shopifyRow);
    }
  });

  return result;
}
