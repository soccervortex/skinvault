# Pusher Setup Guide

De chat gebruikt nu **Pusher** voor real-time updates in plaats van SSE. Dit is veel sneller en betrouwbaarder, vooral op Vercel.

## Stap 1: Maak een gratis Pusher account

1. Ga naar https://pusher.com/
2. Klik op "Sign Up" (gratis)
3. Maak een account aan

## Stap 2: Maak een nieuwe app

1. Na het inloggen, klik op "Create app"
2. Kies een naam (bijv. "SkinVault Chat")
3. Kies een cluster (bijv. "eu" voor Europa, of "us-east" voor VS)
4. Kies "Vanilla JS" als frontend framework
5. Klik "Create app"

## Stap 3: Haal je credentials op

Na het aanmaken van de app zie je:
- **App ID**
- **Key** (dit is je `NEXT_PUBLIC_PUSHER_KEY`)
- **Secret** (dit is je `PUSHER_SECRET`)
- **Cluster** (bijv. "eu")

## Stap 4: Voeg environment variables toe

Voeg deze toe aan je `.env.local` en Vercel environment variables:

```env
PUSHER_APP_ID=your_app_id_here
NEXT_PUBLIC_PUSHER_KEY=your_key_here
PUSHER_SECRET=your_secret_here
PUSHER_CLUSTER=eu
```

**Belangrijk:** 
- `NEXT_PUBLIC_PUSHER_KEY` moet beginnen met `NEXT_PUBLIC_` omdat het gebruikt wordt in de browser
- De andere variabelen zijn server-side only

## Stap 5: Pusher gratis tier limits

De gratis tier van Pusher biedt:
- ✅ 200,000 messages per dag
- ✅ 100 concurrent connections
- ✅ Unlimited channels
- ✅ WebSocket-based (net zo snel als Discord!)

Dit is ruim voldoende voor de meeste chat applicaties.

## Stap 6: Test de chat

1. Start de development server: `npm run dev`
2. Ga naar `/chat`
3. De chat zou nu real-time moeten werken via WebSockets!

## Troubleshooting

**Chat werkt niet:**
- Controleer of alle environment variables correct zijn ingesteld
- Check de browser console voor Pusher errors
- Zorg dat `NEXT_PUBLIC_PUSHER_KEY` begint met `NEXT_PUBLIC_`

**"Authentication failed" error:**
- Controleer of `PUSHER_SECRET` correct is ingesteld
- Check of de `/api/pusher/auth` route werkt

**Chat laadt langzaam:**
- Pusher gebruikt WebSockets, wat veel sneller is dan SSE
- Als het nog steeds langzaam is, check je internetverbinding

## Upgrade naar betaalde tier (optioneel)

Als je meer dan 200k messages/dag nodig hebt:
- Starter: $49/maand (500k messages/dag, 500 concurrent connections)
- Growth: $99/maand (1M messages/dag, 1000 concurrent connections)

Voor de meeste applicaties is de gratis tier meer dan genoeg!

