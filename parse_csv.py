import csv
import json

def parse_csv_to_json():
    players = []
    categories_map = {
        'M1': 'Marquee', 'M2': 'Marquee',
        'BA1': 'Batters', 'BA2': 'Batters', 'BA3': 'Batters', 'BA4': 'Batters', 'BA5': 'Batters',
        'AL1': 'All-Rounders', 'AL2': 'All-Rounders', 'AL3': 'All-Rounders', 'AL4': 'All-Rounders',
        'AL5': 'All-Rounders', 'AL6': 'All-Rounders', 'AL7': 'All-Rounders', 'AL8': 'All-Rounders',
        'AL9': 'All-Rounders', 'AL10': 'All-Rounders',
        'WK1': 'Wicket-Keepers', 'WK2': 'Wicket-Keepers', 'WK3': 'Wicket-Keepers', 'WK4': 'Wicket-Keepers',
        'FA1': 'Fast Bowlers', 'FA2': 'Fast Bowlers', 'FA3': 'Fast Bowlers', 'FA4': 'Fast Bowlers',
        'FA5': 'Fast Bowlers', 'FA6': 'Fast Bowlers', 'FA7': 'Fast Bowlers', 'FA8': 'Fast Bowlers',
        'FA9': 'Fast Bowlers', 'FA10': 'Fast Bowlers',
        'SP1': 'Spin Bowlers', 'SP2': 'Spin Bowlers', 'SP3': 'Spin Bowlers',
        'UBA1': 'Uncapped Batters', 'UBA2': 'Uncapped Batters', 'UBA3': 'Uncapped Batters',
        'UBA4': 'Uncapped Batters', 'UBA5': 'Uncapped Batters', 'UBA6': 'Uncapped Batters',
        'UBA7': 'Uncapped Batters', 'UBA8': 'Uncapped Batters', 'UBA9': 'Uncapped Batters',
        'UAL1': 'Uncapped All-Rounders', 'UAL2': 'Uncapped All-Rounders', 'UAL3': 'Uncapped All-Rounders',
        'UAL4': 'Uncapped All-Rounders', 'UAL5': 'Uncapped All-Rounders', 'UAL6': 'Uncapped All-Rounders',
        'UAL7': 'Uncapped All-Rounders', 'UAL8': 'Uncapped All-Rounders', 'UAL9': 'Uncapped All-Rounders',
        'UAL10': 'Uncapped All-Rounders', 'UAL11': 'Uncapped All-Rounders', 'UAL12': 'Uncapped All-Rounders',
        'UAL13': 'Uncapped All-Rounders', 'UAL14': 'Uncapped All-Rounders', 'UAL15': 'Uncapped All-Rounders',
        'UWK1': 'Uncapped Wicket-Keepers', 'UWK2': 'Uncapped Wicket-Keepers', 'UWK3': 'Uncapped Wicket-Keepers',
        'UWK4': 'Uncapped Wicket-Keepers', 'UWK5': 'Uncapped Wicket-Keepers', 'UWK6': 'Uncapped Wicket-Keepers',
        'UFA1': 'Uncapped Fast Bowlers', 'UFA2': 'Uncapped Fast Bowlers', 'UFA3': 'Uncapped Fast Bowlers',
        'UFA4': 'Uncapped Fast Bowlers', 'UFA5': 'Uncapped Fast Bowlers', 'UFA6': 'Uncapped Fast Bowlers',
        'UFA7': 'Uncapped Fast Bowlers', 'UFA8': 'Uncapped Fast Bowlers', 'UFA9': 'Uncapped Fast Bowlers',
        'UFA10': 'Uncapped Fast Bowlers',
        'USP1': 'Uncapped Spinners', 'USP2': 'Uncapped Spinners', 'USP3': 'Uncapped Spinners',
        'USP4': 'Uncapped Spinners', 'USP5': 'Uncapped Spinners'
    }
    
    with open('1731674068078_TATA IPL 2025- Auction List -15.11.24.csv', 'r', encoding='utf-8') as file:
        csv_reader = csv.reader(file)
        
        for row in csv_reader:
            # Skip empty rows or header rows
            if not row or not row[0] or row[0] == 'List Sr.No.' or 'TATA IPL' in row[0]:
                continue
            
            try:
                list_no = row[0].strip()
                if not list_no.isdigit():
                    continue
                
                set_code = row[2].strip() if len(row) > 2 else ''
                if not set_code or set_code not in categories_map:
                    continue
                
                first_name = row[3].strip() if len(row) > 3 else ''
                surname = row[4].strip() if len(row) > 4 else ''
                country = row[5].strip() if len(row) > 5 else ''
                age = row[8].strip() if len(row) > 8 else '0'
                role = row[9].strip() if len(row) > 9 else ''
                batting = row[10].strip() if len(row) > 10 else ''
                bowling = row[11].strip() if len(row) > 11 else ''
                prev_team = row[17].strip() if len(row) > 17 else ''
                capped_status = row[19].strip() if len(row) > 19 else 'Uncapped'
                base_price_lakh = row[20].strip() if len(row) > 20 else '30'
                
                if not first_name or not surname:
                    continue
                
                # Convert base price from lakhs to rupees
                try:
                    base_price = int(base_price_lakh) * 100000
                except:
                    base_price = 3000000
                
                # Determine if overseas
                is_overseas = country not in ['India', '']
                
                player = {
                    'id': f'P{list_no.zfill(3)}',
                    'name': f'{first_name} {surname}',
                    'country': country,
                    'role': role,
                    'battingStyle': batting if batting else None,
                    'bowlingStyle': bowling if bowling else None,
                    'basePrice': base_price,
                    'isOverseas': is_overseas,
                    'previousTeam': prev_team if prev_team else None,
                    'category': categories_map.get(set_code, 'Other'),
                    'set': set_code,
                    'age': int(age) if age.isdigit() else 0,
                    'isCapped': capped_status == 'Capped'
                }
                
                players.append(player)
                
            except Exception as e:
                print(f'Error processing row: {e}')
                continue
    
    # Create categories structure
    categories = [
        {'id': 'marquee', 'name': 'Marquee Players', 'sets': ['M1', 'M2']},
        {'id': 'batters', 'name': 'Batters', 'sets': ['BA1', 'BA2', 'BA3', 'BA4', 'BA5']},
        {'id': 'allrounders', 'name': 'All-Rounders', 'sets': ['AL1', 'AL2', 'AL3', 'AL4', 'AL5', 'AL6', 'AL7', 'AL8', 'AL9', 'AL10']},
        {'id': 'wicketkeepers', 'name': 'Wicket-Keepers', 'sets': ['WK1', 'WK2', 'WK3', 'WK4']},
        {'id': 'fast_bowlers', 'name': 'Fast Bowlers', 'sets': ['FA1', 'FA2', 'FA3', 'FA4', 'FA5', 'FA6', 'FA7', 'FA8', 'FA9', 'FA10']},
        {'id': 'spinners', 'name': 'Spin Bowlers', 'sets': ['SP1', 'SP2', 'SP3']},
        {'id': 'uncapped_batters', 'name': 'Uncapped Batters', 'sets': ['UBA1', 'UBA2', 'UBA3', 'UBA4', 'UBA5', 'UBA6', 'UBA7', 'UBA8', 'UBA9']},
        {'id': 'uncapped_allrounders', 'name': 'Uncapped All-Rounders', 'sets': ['UAL1', 'UAL2', 'UAL3', 'UAL4', 'UAL5', 'UAL6', 'UAL7', 'UAL8', 'UAL9', 'UAL10', 'UAL11', 'UAL12', 'UAL13', 'UAL14', 'UAL15']},
        {'id': 'uncapped_wicketkeepers', 'name': 'Uncapped Wicket-Keepers', 'sets': ['UWK1', 'UWK2', 'UWK3', 'UWK4', 'UWK5', 'UWK6']},
        {'id': 'uncapped_fast_bowlers', 'name': 'Uncapped Fast Bowlers', 'sets': ['UFA1', 'UFA2', 'UFA3', 'UFA4', 'UFA5', 'UFA6', 'UFA7', 'UFA8', 'UFA9', 'UFA10']},
        {'id': 'uncapped_spinners', 'name': 'Uncapped Spinners', 'sets': ['USP1', 'USP2', 'USP3', 'USP4', 'USP5']}
    ]
    
    output = {
        'categories': categories,
        'players': players
    }
    
    with open('src/data/players.json', 'w', encoding='utf-8') as outfile:
        json.dump(output, outfile, indent=2, ensure_ascii=False)
    
    print(f'Successfully converted {len(players)} players to JSON!')

if __name__ == '__main__':
    parse_csv_to_json()
