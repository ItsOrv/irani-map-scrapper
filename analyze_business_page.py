#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re
import json
import urllib.request
import urllib.parse

# Get homepage
print("Fetching homepage...")
req = urllib.request.Request('https://balad.ir', headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'})
with urllib.request.urlopen(req, timeout=10) as response:
    html = response.read().decode('utf-8')

# Extract __NEXT_DATA__
match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    widgets = data.get('props', {}).get('pageProps', {}).get('data', {}).get('widgets', [])
    
    for widget in widgets:
        if widget.get('type') == 'horizontal_list':
            items = widget.get('data', {}).get('items', [])
            if items:
                first_item = items[0]
                url_title = first_item.get('urlTitle', '')
                if url_title:
                    # Properly encode the URL
                    business_url = f'https://balad.ir/{url_title}'
                    print(f"\n=== Found Business ===")
                    print(f"Name: {first_item.get('name', 'N/A')}")
                    print(f"Category: {first_item.get('category', 'N/A')}")
                    print(f"URL: {business_url}")
                    
                    # Parse and properly encode URL
                    parsed = urllib.parse.urlparse(business_url)
                    encoded_path = urllib.parse.quote(parsed.path, safe='/')
                    encoded_url = f"{parsed.scheme}://{parsed.netloc}{encoded_path}"
                    print(f"Encoded URL: {encoded_url}")
                    
                    # Get business detail page
                    print("\n=== Fetching Detail Page ===")
                    detail_req = urllib.request.Request(
                        encoded_url, 
                        headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'}
                    )
                    try:
                        with urllib.request.urlopen(detail_req, timeout=15) as detail_response:
                            detail_html = detail_response.read().decode('utf-8')
                            
                            # Extract __NEXT_DATA__ from detail page
                            detail_match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', detail_html, re.DOTALL)
                            if detail_match:
                                detail_data = json.loads(detail_match.group(1))
                                print("\n=== Business Detail Data Structure ===")
                                
                                # Pretty print the structure
                                def print_structure(obj, indent=0, max_depth=3):
                                    if indent > max_depth:
                                        return
                                    prefix = "  " * indent
                                    if isinstance(obj, dict):
                                        for key, value in list(obj.items())[:10]:  # Limit to first 10 items
                                            if isinstance(value, (dict, list)):
                                                print(f"{prefix}{key}:")
                                                print_structure(value, indent+1, max_depth)
                                            else:
                                                print(f"{prefix}{key}: {str(value)[:100]}")
                                    elif isinstance(obj, list):
                                        for i, item in enumerate(obj[:5]):  # Limit to first 5 items
                                            print(f"{prefix}[{i}]:")
                                            print_structure(item, indent+1, max_depth)
                                
                                print_structure(detail_data)
                                
                                # Look for phone/email in the data
                                data_str = json.dumps(detail_data, ensure_ascii=False)
                                if 'phone' in data_str.lower() or 'تلفن' in data_str:
                                    print("\n=== Phone found in data ===")
                                    phone_patterns = [
                                        r'"phone":\s*"([^"]+)"',
                                        r'"tel":\s*"([^"]+)"',
                                        r'"telephone":\s*"([^"]+)"',
                                        r'تلفن[^"]*"([^"]+)"'
                                    ]
                                    for pattern in phone_patterns:
                                        matches = re.findall(pattern, data_str, re.IGNORECASE)
                                        if matches:
                                            print(f"  Found: {matches[:3]}")
                                
                                if 'email' in data_str.lower() or 'ایمیل' in data_str or 'mail' in data_str.lower():
                                    print("\n=== Email found in data ===")
                                    email_patterns = [
                                        r'"email":\s*"([^"]+)"',
                                        r'"mail":\s*"([^"]+)"',
                                        r'mailto:([^"\s<>]+)'
                                    ]
                                    for pattern in email_patterns:
                                        matches = re.findall(pattern, data_str, re.IGNORECASE)
                                        if matches:
                                            print(f"  Found: {matches[:3]}")
                                
                            # Look for phone/email in HTML
                            print("\n=== Phone/Email in HTML ===")
                            phone_matches = re.findall(r'tel:([^"\'<>\s&]+)', detail_html)
                            email_matches = re.findall(r'mailto:([^"\'<>\s&]+)', detail_html)
                            
                            if phone_matches:
                                print(f"Phones found: {list(set(phone_matches))[:5]}")
                            else:
                                print("No phone links found (tel:)")
                                
                            if email_matches:
                                print(f"Emails found: {list(set(email_matches))[:5]}")
                            else:
                                print("No email links found (mailto:)")
                            
                            # Look for specific text patterns
                            print("\n=== Text Patterns ===")
                            if 'تلفن' in detail_html:
                                # Find context around "تلفن"
                                tel_contexts = re.findall(r'.{0,50}تلفن.{0,50}', detail_html)
                                print(f"Found 'تلفن' in HTML ({len(tel_contexts)} times)")
                                for ctx in tel_contexts[:3]:
                                    print(f"  Context: {ctx[:80]}...")
                            
                            if 'ایمیل' in detail_html or 'email' in detail_html.lower():
                                print("Found 'ایمیل' or 'email' in HTML")
                            
                            # Look for specific CSS classes that might contain contact info
                            print("\n=== CSS Classes ===")
                            class_patterns = [
                                r'class="[^"]*phone[^"]*"',
                                r'class="[^"]*tel[^"]*"',
                                r'class="[^"]*email[^"]*"',
                                r'class="[^"]*contact[^"]*"'
                            ]
                            for pattern in class_patterns:
                                matches = re.findall(pattern, detail_html, re.IGNORECASE)
                                if matches:
                                    print(f"  Found classes: {list(set(matches))[:5]}")
                                    
                    except Exception as e:
                        print(f"Error fetching detail page: {e}")
                        import traceback
                        traceback.print_exc()
                    break

