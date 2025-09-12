from fastapi import FastAPI, Header, HTTPException, Depends
from pydantic import BaseModel
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials # for swagger "Authorize"
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import numpy as np, torch, os, hmac, logging

# Load .env on startup so SERVICE_JWT is available without extra flags
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv(filename=".env"))

# Model setup (Loaded once on startup)
MODEL_ID = "unitary/toxic-bert"
tok = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
labels = ["non-toxic", "toxic"]

# App
app = FastAPI()

# HTTP Bearer tells Swagger about our auth so the "Authorize" button works
# With HTTPBearer, Swagger will add "Authorization: Bearer <token>" for us
bearer = HTTPBearer(auto_error=False)

# Logger for tiny auth debug (does not print the secret)
log = logging.getLogger("uvicorn")

class Inp(BaseModel):
    text: str
    lang: str = "en"

def softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()

def auth_ok(authorization_header: str | None) -> bool:
    # Return True if Authorization header matches SERVICE_JWT
    expected = (os.getenv("SERVICE_JWT") or "").strip()
    if not expected or not authorization_header:
        log.info("Auth check: header missing or secret missing")
        return False
    
    # Accept either "Bearer <token>" or just "<token>", trim spaces, ignore casing of 'Bearer'
    val = authorization_header.strip()
    if val.lower().startswith("bearer "):
        val = val[7:].strip()

    ok = hmac.compare_digest(val, expected)
    # Safe debug: only print Lengths + True/False (never the secret)
    log.info("Auth check: got_len=%d exp_len=%d match=%s", len(val), len(expected), ok)
    return ok

@app.post("/classify")
def classify(
    inp: Inp,
    # Using HTTPBearer so Swagger "Authorize" fills this automatically
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    # Keep the raw header too, in case user types it manually in the header box
    authorization: str | None = Header(None)
):
    # Prefer credentials from the bearer scheme; fall back to raw header
    auth_header = authorization
    if credentials:
        # credentials.scheme will be "Bearer", credentials.credentials is the token
        auth_header = f"{credentials.scheme} {credentials.credentials}"

    if not auth_ok(auth_header):
        raise HTTPException(401, "bad token")
    
    # Tokenization + inference
    batch = tok(inp.text, return_tensors="pt", truncation=True)
    with torch.no_grad():
        logits = model(**batch).logits[0].numpy()

    probs = softmax(logits).tolist()
    return {
        "model": MODEL_ID,
        "top": labels[int(np.argmax(probs))],
        "scores": {labels[i]: float(probs[i]) for i in range(len(labels))}
    }


















# from fastapi import FastAPI, Header, HTTPException
# from pydantic import BaseModel
# from transformers import AutoTokenizer, AutoModelForSequenceClassification
# import numpy as np, torch, os

# from dotenv import load_dotenv, find_dotenv
# load_dotenv(find_dotenv(filename=".env")) # Loads ml/.env

# import os, logging
# logging.getLogger("uvicorn").info("SERVICE_JWT present? %s", bool(os.getenv("SERVICE_JWT")))

# MODEL_ID = "unitary/toxic-bert"
# tok = AutoTokenizer.from_pretrained(MODEL_ID)
# model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
# labels = ["non-toxic", "toxic"]

# app = FastAPI()

# class Inp(BaseModel):
#     text: str
#     lang: str = "en"

# def softmax(x):
#     e = np.exp(x - np.max(x))
#     return e / e.sum()

# @app.post("/classify")
# def classify(inp: Inp, authorization: str | None = Header(None)):
#     # simple bearer check so only your API/worker can call this
#     if authorization != f"Bearer {os.getenv('SERVICE_JWT')}":
#         raise HTTPException(401, "bad token")
    
#     batch = tok(inp.text, return_tensors = "pt", truncation = True)
#     with torch.no_grad():
#         logits = model(**batch).logits[0].numpy()

#     probs = softmax(logits).tolist()
#     return {
#         "model": MODEL_ID,
#         "top": labels[int(np.argmax(probs))],
#         "scores": {labels[i]: float(probs[i]) for i in range (len(labels))}
#     }