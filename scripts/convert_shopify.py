import csv
import os
from typing import List

input_csv = r"c:\Users\matty\Desktop\antigravity projects\csv-converter-pwa\scripts\ZTOW001_ProductData_RSA_2026-03-25.csv"
output_csv = r"c:\Users\matty\Desktop\antigravity projects\csv-converter-pwa\scripts\shopify_converted.csv"

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
    if price is None or price == "": return ""
    try:
        # Remove any currency symbols or commas
        clean_price = str(price).replace('R', '').replace(',', '').strip()
        # Using format to avoid Pyre round() issues and ensure 2 decimal places
        return "{:.2f}".format(float(clean_price))
    except:
        return ""

def process_file():
    if not os.path.exists(input_csv):
        print(f"Error: Input file not found at {input_csv}")
        return

    with open(input_csv, 'r', encoding='utf-8') as f_in, \
         open(output_csv, 'w', newline='', encoding='utf-8') as f_out:
        
        reader = csv.DictReader(f_in)
        writer = csv.DictWriter(f_out, fieldnames=headers)
        writer.writeheader()
        
        for row in reader:
            code = row.get('Code', '').strip()
            if not code:
                continue
                
            handle = code.lower().replace(' ', '-')
            description = row.get('Description', '') or ""
            title = description.strip()
            long_desc = row.get('LongDescription', '') or ""
            narration = row.get('Narration', '') or ""
            body_html_content = long_desc.strip() or narration.strip() or title
            vendor = row.get('Brand', '').strip()
            
            # Pricing
            price = format_price(row.get('RetailPrice', ''))
            cost = format_price(row.get('DiscountPrice', ''))
            
            # Weight
            weight_kg = row.get('Weight_kg', '0')
            try:
                grams = int(float(weight_kg) * 1000)
            except:
                grams = 0
                
            # Categories & Tags
            categories_str = row.get('Categories', '')
            item_type = ""
            tags = ""
            if categories_str:
                cats = [c.strip() for c in categories_str.split('|')]
                if cats:
                    item_type = cats[0]
                    tags = ", ".join(cats)
            
            # Multiple Images handling
            image_list: List[str] = []
            for i in range(1, 9):
                img_url = row.get(f'Image_{i}', '').strip()
                if img_url:
                    image_list.append(img_url)
            
            # First row for the product
            csv_row = {
                "Handle": handle,
                "Title": title,
                "Body (HTML)": f"<div>{body_html_content}</div>",
                "Vendor": vendor,
                "Product Category": "", # Could be mapped later if needed
                "Type": item_type,
                "Tags": tags,
                "Published": "TRUE",
                "Option1 Name": "Title",
                "Option1 Value": "Default Title",
                "Variant SKU": code,
                "Variant Grams": grams,
                "Variant Inventory Tracker": "shopify",
                "Variant Inventory Qty": "0",
                "Variant Inventory Policy": "continue",
                "Variant Fulfillment Service": "manual",
                "Variant Price": price,
                "Variant Requires Shipping": "TRUE",
                "Variant Taxable": "FALSE",
                "Variant Barcode": code,
                "Image Src": "",
                "Image Position": "",
                "Gift Card": "FALSE",
                "Google Shopping / Condition": "new",
                "Variant Weight Unit": "g",
                "Cost per item": cost,
                "Status": "active"
            }
            
            if image_list:
                csv_row["Image Src"] = image_list[0]
                csv_row["Image Position"] = "1"
            
            writer.writerow(csv_row)
            
            # Extra rows for additional images
            if len(image_list) > 1:
                # Iterate from second element onwards
                i = 0
                for img_url in image_list:
                    i += 1
                    if i == 1:
                        continue # Skip first image already handled
                    
                    img_row = {
                        "Handle": handle,
                        "Image Src": img_url,
                        "Image Position": str(i)
                    }
                    writer.writerow(img_row)

if __name__ == "__main__":
    process_file()
    print(f"Generated {output_csv}")
