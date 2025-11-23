# personalization.py

import os
import json
import numpy as np
from typing import Dict, List, Any, Tuple, Optional
from feature_extraction import extract_features

# Path to where we'll store user personalization data
DEFAULT_DB_PATH = r"C:\Users\rohan\OneDrive\Desktop\Datathon\user_phrases.json"


# ---------- 1. Helpers for saving / loading the DB ----------

def load_user_db(db_path: str = DEFAULT_DB_PATH) -> Dict[str, Any]:
    """
    Load the user personalization database from JSON.
    Structure:
    {
      "user_id_1": [
          {"label": "I'm hungry", "features": [0.1, 0.2, ...]},
          {"label": "I'm tired",  "features": [0.05, -0.3, ...]},
          ...
      ],
      "user_id_2": [...],
      ...
    }
    """
    if not os.path.exists(db_path):
        return {}
    with open(db_path, "r") as f:
        db = json.load(f)
    return db


def save_user_db(db: Dict[str, Any], db_path: str = DEFAULT_DB_PATH) -> None:
    """Save the user personalization database to JSON."""
    with open(db_path, "w") as f:
        json.dump(db, f)


# ---------- 2. Distance / similarity helpers ----------

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two 1D vectors."""
    a = np.array(a)
    b = np.array(b)
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) + 1e-9
    return float(np.dot(a, b) / denom)


def euclidean_distance(a: np.ndarray, b: np.ndarray) -> float:
    """Compute Euclidean distance between two 1D vectors."""
    a = np.array(a)
    b = np.array(b)
    return float(np.linalg.norm(a - b))


# ---------- 3. Core APIs: add + predict (feature-vector level) ----------

def add_user_phrase(
        user_id: str,
        feature_vector: np.ndarray,
        label: str,
        db_path: str = DEFAULT_DB_PATH,
) -> None:
    """
    Add a personalized phrase example for a given user.
    - user_id: e.g. "user_123"
    - feature_vector: 1D numpy array representing that audio sample
    - label: a human-readable phrase or tag, e.g. "i_am_hungry"
    """
    db = load_user_db(db_path)

    if user_id not in db:
        db[user_id] = []

    db[user_id].append({
        "label": label,
        "features": feature_vector.tolist()
    })

    save_user_db(db, db_path)
    print(f"✅ Added phrase '{label}' for user '{user_id}'. Total examples: {len(db[user_id])}")


def predict_phrase(
        user_id: str,
        feature_vector: np.ndarray,
        db_path: str = DEFAULT_DB_PATH,
        k: int = 3,
        use_cosine: bool = True
) -> Tuple[Optional[str], float]:
    """
    Predict the personalized phrase for a given user by KNN over stored examples.
    - Returns (predicted_label, confidence)
    - If user has no stored phrases, returns (None, 0.0)
    """
    db = load_user_db(db_path)

    if user_id not in db or len(db[user_id]) == 0:
        print(f"⚠️ No personalization data for user '{user_id}'.")
        return None, 0.0

    examples = db[user_id]

    # Compute similarity or distance to each stored example
    scores = []
    for ex in examples:
        ex_feat = np.array(ex["features"])
        if use_cosine:
            sim = cosine_similarity(feature_vector, ex_feat)
            scores.append((sim, ex["label"]))
        else:
            dist = euclidean_distance(feature_vector, ex_feat)
            # We'll invert distance later, but for now store raw distance
            scores.append((dist, ex["label"]))

    # Sort examples
    if use_cosine:
        # Higher similarity = better
        scores.sort(key=lambda x: x[0], reverse=True)
    else:
        # Lower distance = better
        scores.sort(key=lambda x: x[0])

    # Take top-k neighbors
    k = min(k, len(scores))
    top_k = scores[:k]

    # Majority vote among top-k labels
    label_counts = {}
    for score, lbl in top_k:
        label_counts[lbl] = label_counts.get(lbl, 0) + 1

    # Pick label with highest count (tie broken arbitrarily)
    best_label = max(label_counts.items(), key=lambda x: x[1])[0]

    # Confidence heuristic:
    if use_cosine:
        # Use average similarity of neighbors with best_label
        best_sims = [s for (s, lbl) in top_k if lbl == best_label]
        if len(best_sims) == 0:
            confidence = 0.0
        else:
            # Cosine similarity is typically [-1, 1], we map to [0,1]
            avg_sim = float(np.mean(best_sims))
            confidence = (avg_sim + 1.0) / 2.0
    else:
        # If Euclidean distance, invert so smaller distance => higher "confidence"
        best_dists = [s for (s, lbl) in top_k if lbl == best_label]
        if len(best_dists) == 0:
            confidence = 0.0
        else:
            avg_dist = float(np.mean(best_dists))
            # Map distance to a pseudo-confidence in [0,1] (very rough heuristic)
            confidence = 1.0 / (1.0 + avg_dist)

    return best_label, confidence
# ---------- 4. Audio-path wrappers using Module 1 features ----------

def add_user_phrase_from_audio_path(
    user_id: str,
    audio_path: str,
    label: str,
    db_path: str = DEFAULT_DB_PATH,
) -> None:
    """
    Convenience wrapper:
    - Takes an audio file path
    - Extracts features using extract_features()
    - Stores them as a personalized example.
    """
    feature_vector = extract_features(audio_path)
    add_user_phrase(user_id, feature_vector, label, db_path=db_path)


def predict_phrase_from_audio_path(
    user_id: str,
    audio_path: str,
    db_path: str = DEFAULT_DB_PATH,
    k: int = 3,
    use_cosine: bool = True,
):
    """
    Convenience wrapper:
    - Takes an audio file path
    - Extracts features
    - Runs KNN personalization
    - Returns (label, confidence)
    """
    feature_vector = extract_features(audio_path)
    return predict_phrase(
        user_id=user_id,
        feature_vector=feature_vector,
        db_path=db_path,
        k=k,
        use_cosine=use_cosine,
    )
