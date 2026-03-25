import openpyxl
import csv
import os

input_excel = r"c:\Users\matty\Desktop\antigravity projects\shopify uploads\Tougherdealer.xlsx"
output_csv = r"c:\Users\matty\Desktop\antigravity projects\shopify uploads\converted_shopify.csv"

# Shopify template headers
headers = [
    "Handle", "Title", "Body (HTML)", "Vendor", "Product Category", "Type", "Tags", "Published",
    "Option1 Name", "Option1 Value", "Variant SKU", "Variant Grams", "Variant Inventory Tracker",
    "Variant Inventory Qty", "Variant Inventory Policy", "Variant Fulfillment Service", "Variant Price",
    "Variant Requires Shipping", "Variant Taxable", "Variant Barcode", "Image Src", "Image Position",
    "Gift Card", "Google Shopping / Google Product Category", "Google Shopping / Gender",
    "Google Shopping / Age Group", "Google Shopping / Condition", "Google Shopping / Custom Product",
    "Google: Custom Product (product.metafields.mm-google-shopping.custom_product)",
    "Variant Weight Unit", "Variant Tax Code", "Cost per item", "Status"
]

def format_price(price):
    if price is None: return ""
    try:
        if isinstance(price, str):
            price = price.replace('R', '').replace(',', '').strip()
        return round(float(price), 2)
    except:
        return ""

def process_file():
    wb = openpyxl.load_workbook(input_excel, data_only=True)
    ws = wb.active

    current_brand = ""
    current_model = ""
    current_category = ""
    
    rows = list(ws.values)
    
    with open(output_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        
        for i, row in enumerate(rows):
            # Skip header block
            if i < 6: continue
                
            col0 = row[0]
            col1 = row[1]
            price_rsp = row[2]
            price_dealer = row[3]
            
            # Check for hierarchy headers
            if col0 is not None and not str(col0).startswith('0') and col1 is None and price_rsp is None:
                # Brand or Category
                val = str(col0).strip()
                if val.isupper() and "COVERS" not in val and "ACCESSORIES" not in val and "MATS" not in val:
                    current_brand = val
                else:
                    if "ACCESSORIES" in val or "COVERS" in val or "MATS" in val:
                        current_category = val.replace(" (incl Delivery)", "").replace(" (excl Delivery)", "").replace(" (incl Delivery & Duffel Bag)", "").strip()
                continue
                
            if col0 is None and col1 is not None and price_rsp is None:
                # Could be a model header or sub-category
                val = str(col1).strip()
                if "Single Cab" in val or "Super Cab" in val or "Double Cab" in val:
                    pass # Just sub-header
                else:
                    # Model header
                    current_model = val
                continue
                
            # Data row
            if col0 is not None and col1 is not None and price_rsp is not None:
                part_no = str(col0).strip()
                if part_no == 'Part No': continue # Skip table header
                if part_no == '0': continue # Skip weird rows
                
                desc = str(col1).strip()
                
                # Default type from part prefix if category is missing
                item_type = current_category
                if not item_type:
                    if part_no.startswith('SC'): item_type = "SEAT COVERS"
                    elif part_no.startswith('DC'): item_type = "DASH COVERS"
                    elif part_no.startswith('FM'): item_type = "FLOOR MATS"
                    elif part_no.startswith('A-'): item_type = "ACCESSORIES"
                
                long_title = desc
                if current_brand and current_brand not in long_title.upper():
                    long_title = current_brand + " - " + long_title
                
                short_title = long_title.split(";")[0].strip()
                if item_type and item_type.upper() not in short_title.upper():
                    short_title = short_title + " - " + item_type
                
                csv_row = {
                    "Handle": part_no.lower(),
                    "Title": short_title,
                    "Body (HTML)": f"<p>{long_title}</p>",
                    "Vendor": "TOUGHER",
                    "Product Category": "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Frame & Body Parts",
                    "Type": item_type,
                    "Tags": item_type,
                    "Published": "TRUE",
                    "Option1 Name": "Title",
                    "Option1 Value": "Default Title",
                    "Variant SKU": part_no,
                    "Variant Grams": "0",
                    "Variant Inventory Tracker": "shopify",
                    "Variant Inventory Qty": "0",
                    "Variant Inventory Policy": "continue",
                    "Variant Fulfillment Service": "manual",
                    "Variant Price": format_price(price_rsp),
                    "Variant Requires Shipping": "TRUE",
                    "Variant Taxable": "FALSE",
                    "Variant Barcode": part_no,
                    "Image Src": "", # Need to add images later manually or via logic
                    "Image Position": "1",
                    "Gift Card": "FALSE",
                    "Google Shopping / Google Product Category": "8227",
                    "Google Shopping / Gender": "Unisex",
                    "Google Shopping / Age Group": "Adult",
                    "Google Shopping / Condition": "new",
                    "Google Shopping / Custom Product": "FALSE",
                    "Google: Custom Product (product.metafields.mm-google-shopping.custom_product)": "g",
                    "Cost per item": format_price(price_dealer),
                    "Status": "active"
                }
                
                writer.writerow(csv_row)

if __name__ == "__main__":
    process_file()
    print(f"Generated {output_csv}")
