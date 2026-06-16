import os
import json
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from datetime import datetime
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
CACHE_FILE = 'cache.json'
FEED_URL = 'https://docs.cloud.google.com/feeds/bigquery-release-notes.xml'

def split_updates(content_html):
    """
    Splits the HTML content of a feed entry by its <h3> headings.
    If no <h3> headings are found, treats the entire block as a single 'Update'.
    """
    if not content_html:
        return []
        
    soup = BeautifulSoup(content_html, 'html.parser')
    updates = []
    
    h3_elements = soup.find_all('h3')
    
    if not h3_elements:
        return [{
            'type': 'Update',
            'content': content_html.strip()
        }]
        
    for h3 in h3_elements:
        update_type = h3.get_text().strip()
        
        # Collect all subsequent siblings until the next h3
        content_parts = []
        sibling = h3.next_sibling
        while sibling and sibling.name != 'h3':
            content_parts.append(str(sibling))
            sibling = sibling.next_sibling
            
        updates.append({
            'type': update_type,
            'content': ''.join(content_parts).strip()
        })
        
    return updates

def parse_xml_feed(xml_content):
    """
    Parses the Atom XML feed into structured entries, where each entry represents
    a release date and contains split individual updates.
    """
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        print(f"XML parse error: {e}")
        return []

    # Atom namespace
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    
    for entry_elem in root.findall('atom:entry', ns):
        # Title is the release date (e.g. "June 15, 2026")
        title_elem = entry_elem.find('atom:title', ns)
        date_str = title_elem.text.strip() if title_elem is not None else ""
        
        # Link (alternate link to release notes page)
        link_elem = entry_elem.find('atom:link[@rel="alternate"]', ns)
        if link_elem is None:
            link_elem = entry_elem.find('atom:link', ns)
        link = link_elem.attrib.get('href', '') if link_elem is not None else ''
        
        # Updated timestamp
        updated_elem = entry_elem.find('atom:updated', ns)
        updated_str = updated_elem.text.strip() if updated_elem is not None else ""
        
        # Content HTML
        content_elem = entry_elem.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ""
        
        # Split into individual updates
        raw_updates = split_updates(content_html)
        
        formatted_updates = []
        for i, update in enumerate(raw_updates):
            # Unique ID based on date and index
            date_clean = date_str.replace(' ', '_').replace(',', '')
            update_id = f"{date_clean}_{i}"
            formatted_updates.append({
                'id': update_id,
                'type': update['type'],
                'content': update['content']
            })
            
        entries.append({
            'date': date_str,
            'updated': updated_str,
            'link': link,
            'updates': formatted_updates
        })
        
    return entries

def save_cache(data):
    """Saves the parsed data to a local cache file."""
    cache_data = {
        'last_updated': datetime.now().isoformat(),
        'entries': data
    }
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving cache: {e}")

def load_cache():
    """Loads the parsed data from the local cache file if it exists."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading cache: {e}")
    return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    cached = load_cache()
    
    # Return cached content if available and refresh is not requested
    if not force_refresh and cached:
        return jsonify(cached)
        
    # Fetch live RSS/Atom feed
    try:
        response = requests.get(FEED_URL, timeout=15)
        if response.status_code == 200:
            entries = parse_xml_feed(response.text)
            save_cache(entries)
            return jsonify({
                'last_updated': datetime.now().isoformat(),
                'entries': entries
            })
        else:
            if cached:
                return jsonify({
                    'warning': f"Failed to fetch live feed (HTTP {response.status_code}). Serving cached data.",
                    'last_updated': cached['last_updated'],
                    'entries': cached['entries']
                })
            else:
                return jsonify({'error': f"Failed to fetch live feed (HTTP {response.status_code}) and no cache exists."}), 500
    except Exception as e:
        if cached:
            return jsonify({
                'warning': f"Error fetching feed: {str(e)}. Serving cached data.",
                'last_updated': cached['last_updated'],
                'entries': cached['entries']
            })
        else:
            return jsonify({'error': f"Error fetching feed: {str(e)} and no cache exists."}), 500

if __name__ == '__main__':
    # Default Flask port is 5000
    app.run(debug=True, host='127.0.0.1', port=5000)
