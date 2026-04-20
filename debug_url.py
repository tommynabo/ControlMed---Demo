import os
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv('.env')
database_url = os.getenv('DATABASE_URL', '')
parsed = urlparse(database_url)

print(f'User: {parsed.username}')
print(f'Password: {parsed.password}')
print(f'Host: {parsed.hostname}')
print(f'Port: {parsed.port}')
print(f'Path: {parsed.path}')
print(f'DB Name: {parsed.path.lstrip("/")}')
