
import json
import csv
import os

json_path = r"d:\Onedrive\OneDrive - Sify Technologies Limited\Documents\IPL\src\data\players.json"
csv_path = r"d:\Onedrive\OneDrive - Sify Technologies Limited\Documents\IPL\1731674068078_TATA IPL 2025- Auction List -15.11.24.csv"

def process():
    # Load existing JSON
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    existing_names = {p['name'].lower().strip() for p in data['players']}
    
    new_players = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        # Skip top matter - data starts from line 7 (0-indexed 6)
        # But let's use a more robust way to find the header 'List Sr.No.'
        reader = csv.reader(f)
        header_found = False
        data_rows = []
        for i, row in enumerate(reader):
            if not row: continue
            if 'List Sr.No.' in row:
                header_found = True
                continue
            if header_found:
                # Basic check if it's a data row (should start with a number in first column)
                if row[0].isdigit():
                    data_rows.append(row)

    for row in data_rows:
        # Check row length to avoid IndexError
        if len(row) < 21:
            continue
            
        first_name = row[3].strip()
        last_name = row[4].strip()
        name = f"{first_name} {last_name}".strip()
        
        if not first_name: # Row might be empty or invalid
            continue

        if name.lower() in existing_names:
            continue
            
        country = row[5].strip()
        is_overseas = country.lower() != "india"
        
        try:
            age = int(row[8])
        except:
            age = 0
            
        role = (row[9] or "Unknown").strip().upper()
        batting_style = (row[10] or "Unknown").strip()
        bowling_style = (row[11] or "Unknown").strip()
        
        prev_team = row[17].strip()
        if prev_team == "Team" or not prev_team: # Header noise or empty
            prev_team = "None"
            
        is_capped = row[19].strip().lower() == "capped"
        
        try:
            # Handle possible comma or space in price
            price_str = row[20].strip().replace(',', '')
            price_lakhs = int(price_str)
            base_price = price_lakhs * 100000
        except:
            base_price = 2000000 # Default 20L if unknown
            
        set_name = row[2].strip()
        
        # Determine category based on role
        if not is_capped:
            category = "Uncapped"
        else:
            if "ALL-ROUNDER" in role:
                category = "All-Rounders"
            elif "BATTER" in role or "BATSMAN" in role:
                category = "Batters"
            elif "WICKETKEEPER" in role:
                category = "Wicket-Keepers"
            elif "BOWLER" in role:
                if "SPIN" in bowling_style.upper():
                    category = "Spin Bowlers"
                else:
                    category = "Fast Bowlers"
            else:
                category = "Other"
        
        player_id = f"CSV{row[0]}"
        
        new_player = {
            "id": player_id,
            "name": name,
            "country": country,
            "role": role,
            "battingStyle": batting_style,
            "bowlingStyle": bowling_style,
            "basePrice": base_price,
            "isOverseas": is_overseas,
            "previousTeam": prev_team,
            "category": category,
            "set": set_name,
            "age": age,
            "isCapped": is_capped
        }
        
        new_players.append(new_player)
        existing_names.add(name.lower())

    # Add new players to data
    data['players'].extend(new_players)
    
    # Save back to JSON
    with open(json_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"Added {len(new_players)} new players. Total players: {len(data['players'])}")

if __name__ == "__main__":
    process()
