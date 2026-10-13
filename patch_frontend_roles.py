import os

directory = '/home/nikita/Desktop/Projects/inventory management billing system/msme-paytrack/frontend/src'
for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith(('.jsx', '.js')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()
            
            # Use string replacement for exact matches
            new_content = content.replace("user?.role_name === 'EMPLOYEE'", "['EMPLOYEE', 'USER'].includes(user?.role_name)")
            
            if new_content != content:
                with open(filepath, 'w') as f:
                    f.write(new_content)
                print(f"Patched {filepath}")
