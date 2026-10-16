import xml.etree.ElementTree as ET
import os

config_files = ['config/ingestion.xml', 'config/index.xml', 'config/rag.xml']

for config_file in config_files:
    if os.path.exists(config_file):
        print(f'\nChecking {config_file}...')
        try:
            tree = ET.parse(config_file)
            print(f'✅ {config_file} parses correctly')
        except ET.ParseError as e:
            print(f'❌ {config_file} has parsing error: {e}')
            # Let's look at the first few bytes to see if there are BOM or other issues
            with open(config_file, 'rb') as f:
                first_bytes = f.read(10)
                print(f'First 10 bytes: {first_bytes}')
    else:
        print(f'⚠️  {config_file} does not exist')