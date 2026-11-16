# Rnld Forex AI

Modern dark-themed **AI-powered Forex prediction** platform  
Frontend + FastAPI backend for real live data.

---

## Project Structure

```
rnld-forex-ai/
├── index.html          ← Frontend
├── app.js              ← Frontend logic
├── backend/
│   ├── main.py         ← FastAPI server
│   ├── requirements.txt
│   └── .env.example    ← Copy this to .env
└── README.md
```

---

## 1. Run the Frontend (Demo Mode)

Just open `index.html` in your browser.  
It works immediately with **simulated live data**.

---

## 2. Run the Real Backend (Live Data)

### Step 1 — Install dependencies

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### Step 2 — Add your API key

```bash
cp .env.example .env
```

Open `.env` and paste your key:

```env
DATA_PROVIDER=twelve
TWELVE_DATA_API_KEY=your_real_key_here
```

> Get a free key at: https://twelvedata.com

### Step 3 — Start the backend

```bash
uvicorn main:app --reload --port 8000
```

You should see:
```
Uvicorn running on http://127.0.0.1:8000
```

Test it: open http://localhost:8000/api/health

### Step 4 — Connect the frontend to real data

Open `app.js` and change this line near the top:

```js
const USE_REAL_API = true;   // ← change from false to true
```

Refresh the browser.  
The dashboard will now use **real live prices** from your API.

---

## API Endpoints

| Endpoint                        | Description                  |
|---------------------------------|------------------------------|
| `GET /api/health`               | Check if backend is alive    |
| `GET /api/price/EURUSD`         | Current price                |
| `GET /api/candles/EURUSD?interval=1H&limit=60` | Candles for chart |
| `GET /api/pairs`                | List of supported pairs      |

---

## Supported Providers

- **Twelve Data** (recommended) – best free tier for forex
- Finnhub (price only for now)
- Easy to add more

---

## Disclaimer

This project is for **educational and research purposes only**.  
AI predictions and signals are **not financial advice**.  
Trading forex involves substantial risk of loss.
