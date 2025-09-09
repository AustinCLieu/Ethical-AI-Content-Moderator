from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import numpy as np, torch, os

MODEL_ID = "unitary/toxic-bert"
tok = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
labels = ["non-toxic", "toxic"]

app = FastAPI()

class Inp(BaseModel):
    text: str
    lang: str = "en"

def softmax(x):
    e = np.exp(x - np.max(x))
    return e / e.sum()

@app.post("/classify")
def classify(inp: Inp, authorization: str | None = Header(None)):
    # simple bearer check so only your API/worker can call this
    if authorization != f"Bearer {os.getenv('SERVICE_JWT')}":
        raise HTTPException(401, "bad token")
    
    batch = tok(inp.text, return_tensors = "pt", truncation = True)
    with torch.no_grad():
        logits = model(**batch).logits[0].numpy()

    probs = softmax(logits).tolist()
    return {
        "model": MODEL_ID,
        "top": labels[int(np.argmax(probs))],
        "scores": {labels[i]: float(probs[i]) for i in range (len(labels))}
    }