import json
with open('/home/z/my-project/src/data/api-reference.json') as f:
    data = json.load(f)
print('=== Getting Started ===')
for p in data.get('gettingStarted', []):
    print(f'  /docs/getting-started/{p["slug"]}  — {p["title"]}')
print()
print('=== Guides ===')
for p in data.get('guides', []):
    print(f'  /docs/guides/{p["slug"]}  — {p["title"]}')
print()
print('=== API Reference Domains ===')
for d in data.get('domains', []):
    print(f'  /docs/api-reference/{d["slug"]}  — {d.get("code","")} {d["name"]}')
    for r in d.get('resources', [])[:5]:
        print(f'      /docs/api-reference/{d["slug"]}/{r["slug"]}  — {r["name"]}')
print()
print('=== Appendices ===')
appendices = data.get('appendices', [])
if isinstance(appendices, list):
    for p in appendices:
        if isinstance(p, dict):
            print(f'  /docs/appendices/{p.get("slug","?")}  — {p.get("title","?")}')
        else:
            print(f'  /docs/appendices/{p}  (string)')
elif isinstance(appendices, dict):
    for k, v in appendices.items():
        print(f'  /docs/appendices/{k}  — {v if isinstance(v,str) else v.get("title","?")}')
print()
print('Total counts:')
print(f'  Getting Started pages: {len(data.get("gettingStarted",[]))}')
print(f'  Guide pages:           {len(data.get("guides",[]))}')
print(f'  API Reference domains: {len(data.get("domains",[]))}')
total_resources = 0
for d in data.get('domains', []):
    if isinstance(d.get('resources'), list):
        total_resources += len(d['resources'])
print(f'  Total API resources:   {total_resources}')
print(f'  Appendices:            {len(data.get("appendices",[]))}')
