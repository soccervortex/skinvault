import requests
from bs4 import BeautifulSoup
import json
import time
import re
import os
from flask import Flask, jsonify
from supabase import create_client
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- 1. CONFIGURATIE ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://yjqmyisfllfurendwtdg.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
TRUSTPILOT_URL = os.getenv("TRUSTPILOT_URL", "https://nl.trustpilot.com/review/skinvaults.online")
SITEJABBER_URL = os.getenv("SITEJABBER_URL", "https://www.sitejabber.com/reviews/skinvaults.online")
SERVER_PORT = int(os.getenv("SERVER_PORT_REVIEWS", "8060"))

# Validate required environment variables
if not SUPABASE_KEY:
    raise ValueError("SUPABASE_KEY or SUPABASE_ANON_KEY must be set in environment variables")

# Initialiseer Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Logboek in geheugen
debug_log = {
    "status": "Systeem opgestart",
    "laatste_check": "Nog geen",
    "gevonden_reviews": 0,
    "fouten": []
}

# --- 2. DE SCRAPER LOGICA ---
def scrape_trustpilot():
    """Scrape Trustpilot reviews"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    success_count = 0
    try:
        response = requests.get(TRUSTPILOT_URL, headers=headers, timeout=15)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Zoek naar de kaarten gebaseerd op de HTML
        review_cards = soup.find_all("div", {"data-testid": "service-review-card-v2"})
        
        for card in review_cards:
            try:
                # Naam extraheren
                name_el = card.find("span", {"data-consumer-name-typography": "true"})
                name = name_el.text.strip() if name_el else "Anoniem"
                
                # Tekst extraheren
                text_el = card.find("p", {"data-service-review-text-typography": "true"})
                text = text_el.text.strip() if text_el else ""
                
                # Rating extraheren (uit de alt tekst van de sterren)
                rating_img = card.find("img", {"class": "CDS_StarRating_starRating__614d2e"})
                rating = 5
                if rating_img and "alt" in rating_img.attrs:
                    # Haalt de '5' uit "Beoordeeld met 5 van de 5 sterren"
                    rating = int(rating_img['alt'].split(' ')[2])

                # Datum extraheren
                time_tag = card.find("time")
                date = time_tag['datetime'] if time_tag else time.strftime('%Y-%m-%dT%H:%M:%SZ')

                review_obj = {
                    "id": f"tp-{hash(name + date)}",
                    "source": "Trustpilot",
                    "rating": rating,
                    "reviewer_name": name,
                    "review_text": text,
                    "review_date": date,
                    "verified": True
                }

                # Push naar Supabase
                supabase.table("reviews").upsert(review_obj).execute()
                success_count += 1
                print(f"[Trustpilot] Gepusht naar cloud: {name}")

            except Exception as e:
                debug_log["fouten"].append(f"Trustpilot kaart fout: {str(e)}")
    
    except Exception as e:
        debug_log["fouten"].append(f"Trustpilot scrape fout: {str(e)}")
        print(f"[Trustpilot] Fout: {e}")
    
    return success_count

def scrape_sitejabber():
    """Scrape Sitejabber reviews"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    success_count = 0
    try:
        response = requests.get(SITEJABBER_URL, headers=headers, timeout=15)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Sitejabber gebruikt verschillende selectors, probeer meerdere
        review_cards = soup.find_all("div", class_=lambda x: x and "review" in x.lower())
        
        # Als dat niet werkt, probeer andere selectors
        if not review_cards:
            review_cards = soup.find_all("div", {"itemprop": "review"})
        
        if not review_cards:
            review_cards = soup.find_all("article", class_=lambda x: x and "review" in x.lower())
        
        for card in review_cards[:20]:  # Limiteer tot 20 reviews per run
            try:
                # Naam extraheren
                name_el = card.find("span", class_=lambda x: x and "name" in x.lower())
                if not name_el:
                    name_el = card.find("strong")
                if not name_el:
                    name_el = card.find("a", class_=lambda x: x and "name" in x.lower())
                name = name_el.text.strip() if name_el else "Anoniem"
                
                # Tekst extraheren
                text_el = card.find("p", class_=lambda x: x and "text" in x.lower())
                if not text_el:
                    text_el = card.find("div", class_=lambda x: x and "text" in x.lower())
                if not text_el:
                    text_el = card.find("div", {"itemprop": "reviewBody"})
                text = text_el.text.strip() if text_el else ""
                
                # Rating extraheren - zoek naar sterren of rating elementen
                rating = 5
                rating_el = card.find("div", class_=lambda x: x and ("rating" in x.lower() or "star" in x.lower()))
                if rating_el:
                    # Probeer rating uit class of data attributen te halen
                    classes = rating_el.get('class', [])
                    for cls in classes:
                        if 'star' in cls.lower() or 'rating' in cls.lower():
                            # Probeer nummer uit class te halen (bijv. "rating-5")
                            match = re.search(r'(\d)', cls)
                            if match:
                                rating = int(match.group(1))
                                break
                
                # Zoek naar sterren in alt tekst
                star_imgs = card.find_all("img", alt=lambda x: x and ("star" in x.lower() or "rating" in x.lower()))
                if star_imgs:
                    for img in star_imgs:
                        alt = img.get('alt', '')
                        match = re.search(r'(\d)', alt)
                        if match:
                            rating = int(match.group(1))
                            break

                # Datum extraheren
                time_tag = card.find("time")
                if not time_tag:
                    time_tag = card.find("span", class_=lambda x: x and "date" in x.lower())
                date = time_tag.get('datetime', '') if time_tag and time_tag.get('datetime') else (time_tag.text.strip() if time_tag else time.strftime('%Y-%m-%dT%H:%M:%SZ'))

                review_obj = {
                    "id": f"sj-{hash(name + date)}",
                    "source": "Sitejabber",
                    "rating": rating,
                    "reviewer_name": name,
                    "review_text": text,
                    "review_date": date,
                    "verified": False
                }

                # Push naar Supabase
                supabase.table("reviews").upsert(review_obj).execute()
                success_count += 1
                print(f"[Sitejabber] Gepusht naar cloud: {name}")

            except Exception as e:
                debug_log["fouten"].append(f"Sitejabber kaart fout: {str(e)}")
    
    except Exception as e:
        debug_log["fouten"].append(f"Sitejabber scrape fout: {str(e)}")
        print(f"[Sitejabber] Fout: {e}")
    
    return success_count

def scrape_and_push():
    print(f"\n[{time.ctime()}] --- SCRAPE RUN START ---")
    debug_log["laatste_check"] = time.ctime()
    debug_log["fouten"] = []
    
    # Scrape beide bronnen
    trustpilot_count = scrape_trustpilot()
    sitejabber_count = scrape_sitejabber()
    
    total_count = trustpilot_count + sitejabber_count
    debug_log["gevonden_reviews"] = total_count
    debug_log["status"] = f"OK: {trustpilot_count} Trustpilot, {sitejabber_count} Sitejabber" if total_count > 0 else "Geen reviews gevonden"
    print(f"Run voltooid. {total_count} reviews verwerkt ({trustpilot_count} Trustpilot, {sitejabber_count} Sitejabber).")

# --- 3. SCHEDULER INITIALISATIE (Hier zat de fout) ---
scheduler = BackgroundScheduler()
scheduler.add_job(func=scrape_and_push, trigger="interval", hours=1)
scheduler.start()

# --- 4. FLASK WEB SERVER ---
app = Flask(__name__)

@app.route('/')
def home():
    return "Scraper draait. Ga naar /reviews voor status."

@app.route('/reviews')
def reviews_status():
    return jsonify({
        "server_tijd": time.ctime(),
        "log": debug_log
    })

@app.route('/status')
def status():
    return "Online!", 200

if __name__ == "__main__":
    # Voer direct een scan uit bij opstarten
    scrape_and_push()
    # Start de server
    app.run(host='0.0.0.0', port=SERVER_PORT, debug=False)