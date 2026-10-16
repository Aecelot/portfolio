import xml.etree.ElementTree as ET

# Parse XML file
tree = ET.parse("config/rag.xml")
root = tree.getroot()

# Convert XML to dictionary
def xml_to_dict(element):
    result = {}

    # Add attributes if any
    if element.attrib:
        result.update(element.attrib)

    # Check if element has children
    children = list(element)

    if not children:
        # No children - this is a simple value
        text = element.text.strip() if element.text else ""
        if not text and not element.attrib:
            return {}  # Empty element as empty dict
        # Always return a dict, even for simple text values
        if text:
            result['value'] = text
        return result
    else:
        # Has children - process as complex element
        # Add text content if any (for mixed content)
        if element.text and element.text.strip():
            result['value'] = element.text.strip()

        # Process children
        for child in children:
            child_dict = xml_to_dict(child)

            # Handle multiple children with same name
            if child.tag in result:
                if not isinstance(result[child.tag], list):
                    result[child.tag] = [result[child.tag]]
                result[child.tag].append(child_dict)
            else:
                result[child.tag] = child_dict

        return result

config = xml_to_dict(root)

# Special handling for domains structure
if isinstance(config, dict) and 'domains' in config:
    domains_element = config['domains']
    if isinstance(domains_element, dict) and 'domain' in domains_element:
        domain_list = domains_element['domain']
        if isinstance(domain_list, list):
            domains_dict = {}
            for domain_item in domain_list:
                if isinstance(domain_item, dict) and 'name' in domain_item:
                    domain_name = domain_item['name']
                    domains_dict[domain_name] = domain_item
            config['domains'] = domains_dict

print("Parsed config:")
print(f"Config type: {type(config)}")
if isinstance(config, dict):
    print(f"Domains type: {type(config.get('domains'))}")
    print(f"Domains content: {config.get('domains')}")
else:
    print(f"Config is not a dict: {config}")

# Test the domain matching logic
file_path = "corpus/bestiary.md"
path_str = str(file_path)

print(f"\nTesting file: {file_path}")
if isinstance(config, dict):
    for domain, domain_config in config.get('domains', {}).items():
        print(f"Domain: {domain}, Config type: {type(domain_config)}")
        if isinstance(domain_config, dict):
            path_glob_raw = domain_config.get('path_glob', '')
            # Handle case where path_glob might be a dict with 'value' key
            if isinstance(path_glob_raw, dict):
                path_glob = path_glob_raw.get('value', '')
            else:
                path_glob = path_glob_raw
            print(f"  Path glob: {path_glob}")
            print(f"  Matches: {path_glob in path_str}")
else:
    print("Config is not a dictionary, cannot process domains")