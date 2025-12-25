import requests
from bs4 import BeautifulSoup
import json
from supabase import create_client
from flask_apscheduler import BackgroundScheduler
from flask import Flask

# --- CONFIGURATIE ---
SUPABASE_URL = "https://yjqmyisfllfurendwtdg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqcW15aXNmbGxmdXJlbmR3dGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MjQxNTEsImV4cCI6MjA4MjEwMDE1MX0.2lI0dc8F9ceYruQpXg9SgkCCCJWt1Hl9DgMOvDXdAKY"
TARGET_URL = "https://nl.trustpilot.com/review/skinvaults.online"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def scrape_and_push():
    print("Scraping gestart...")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    
    try:
        response = requests.get(TARGET_URL, headers=headers)
        soup = BeautifulSoup(response.content, 'html.parser')
        script_tag = soup.find("script", id="__NEXT_DATA__")
        
        if script_tag:
            raw_data = json.loads(script_tag.string)
            reviews = raw_data['props']['pageProps']['reviews']
            
            for r in reviews:
                data = {
                    "id": f"tp-{r['id']}",
                    "source": "Trustpilot",
                    "rating": r['rating'],
                    "reviewer_name": r['consumer']['displayName'],
                    "review_text": r.get('text', ''),
                    "review_date": r['dates']['publishedDate'],
                    "verified": len(r.get('verifications', [])) > 0
                }
                # Upsert voorkomt dubbele reviews
                supabase.table("reviews").upsert(data).execute()
            
            print(f"Succesvol {len(reviews)} reviews bijgewerkt in de cloud.")
    except Exception as e:
        print(f"Fout: {e}")

# Draai elk uur
scheduler = BackgroundScheduler()
scheduler.add_job(func=scrape_and_push, trigger="interval", hours=1)
scheduler.start()

# Simpele webserver om het script levend te houden op bijv. Render of je PC
app = Flask(__name__)

@app.route('/')
def home(): 
    return "Scraper is actief"

@app.route('/status')
def status():
    return "Online!", 200

if __name__ == "__main__":
    scrape_and_push() # Directe start
    app.run(host='0.0.0.0', port=5000)