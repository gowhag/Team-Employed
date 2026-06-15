# Asynchronous Interview Mastery Dashboard

A demo Flask app integrating Agnes AI for resume tailoring, live recording, and review analytics.

Quick start

1. Copy the example env and add your Agnes key:

```powershell
copy .env.example .env
# edit .env and add your key
```

2. Install dependencies:

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

3. Run the server:

```powershell
python server.py
```

4. Open `http://localhost:5000` in a browser. Use Chrome for speech recognition support.

Notes

- This is a hackathon demo scaffold. Agnes API responses are expected to return plain JSON in the parse route for best results.
- The browser speech recognition API is used for quick local transcripts (Chrome/Edge recommended). If unsupported, the app will fall back to a simulated transcript.
