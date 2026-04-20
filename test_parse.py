import os
from dotenv import load_dotenv

load_dotenv('.env')
database_url = os.getenv('DATABASE_URL', '')
print('Has URL:', 'postgresql://' in database_url)
