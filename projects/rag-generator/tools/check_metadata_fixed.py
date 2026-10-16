import json

print('Checking store contents...')
with open('storage/store/meta.jsonl', 'r') as f:
    count = 0
    for line in f:
        if count < 3:
            data = json.loads(line.strip())
            print(f'Entry {count+1}:')
            print(f'  Title: {data.get("title", "No title")}')
            print(f'  Content length: {len(data.get("text", ""))} chars')
            print(f'  Domain: {data.get("domain_type", "No domain")}')
            print(f'  Content preview: {data.get("text", "")[:100]}...')
            print()
        count += 1
    print(f'Total entries: {count}')