import librosa
import numpy as np
import pandas as pd
import os
from pathlib import Path
from audio_preprocessing import normalize_and_trim, SR

# --- Configuration Constants ---
N_MFCC = 40
N_FFT = 2048
HOP_LENGTH = 512

def extract_features(audio_path: str) -> np.ndarray:
    """
    Extracts purely technical features: MFCCs, Pitch, and Energy.
    """
    # 1. Preprocess the audio
    y_trimmed, sr = normalize_and_trim(audio_path, SR)

    if y_trimmed.size == 0:
        return None

    # [cite_start]2. Extract MFCCs [cite: 14]
    mfccs = librosa.feature.mfcc(
        y=y_trimmed, sr=sr, n_mfcc=N_MFCC, n_fft=N_FFT, hop_length=HOP_LENGTH
    )

    # [cite_start]3. Extract Energy (RMS) [cite: 14]
    rms = librosa.feature.rms(
        y=y_trimmed, frame_length=N_FFT, hop_length=HOP_LENGTH
    )

    # [cite_start]4. Extract Pitch (F0 using pYIN) [cite: 14]
    f0, voiced_flag, voiced_probs = librosa.pyin(
        y=y_trimmed,
        fmin=librosa.note_to_hz('C2'),
        fmax=librosa.note_to_hz('C7'),
        sr=sr,
        frame_length=N_FFT,
        hop_length=HOP_LENGTH
    )

    # 5. Feature Aggregation
    aggregated_features = []

    # MFCCs: Mean and Std
    for coeff in mfccs:
        aggregated_features.extend([np.mean(coeff), np.std(coeff)])

    # Energy: Mean and Std
    aggregated_features.extend([np.mean(rms), np.std(rms)])

    # Pitch: Mean and Std
    f0_valid = f0[~np.isnan(f0)]
    if len(f0_valid) > 0:
        aggregated_features.extend([np.mean(f0_valid), np.std(f0_valid)])
    else:
        aggregated_features.extend([0.0, 0.0])

    return np.array(aggregated_features)

def process_files(file_list: list) -> list:
    """
    Helper: Processes a list of files and returns a list of row dictionaries.
    Removes redundancy between create and update functions.
    """
    processed_rows = []
    print(f"Processing {len(file_list)} files...")

    for audio_path in file_list:
        if not audio_path.exists():
            continue

        feature_vector = extract_features(str(audio_path))

        if feature_vector is not None:
            row = {'filepath': str(audio_path.name)}
            for i, val in enumerate(feature_vector):
                row[f'feature_{i}'] = val
            processed_rows.append(row)

    return processed_rows

def create_feature_csv(file_list: list, output_filename: str = 'features.csv'):
    """Generates the features.csv from scratch."""
    data = process_files(file_list)

    if data:
        df = pd.DataFrame(data)
        df.to_csv(output_filename, index=False)
        print(f"✅ Created {output_filename} with {len(df)} rows.")
    else:
        print("❌ No features extracted.")

def update_feature_csv(folder_path: Path, csv_path: str = 'features.csv'):
    """
    Smart updater: Only processes files not already in the CSV.
    """
    csv_file = Path(csv_path)

    # 1. If CSV doesn't exist, create it from scratch
    if not csv_file.exists():
        print(f"CSV not found. Creating new one...")
        all_files = list(folder_path.glob("**/*.wav"))
        create_feature_csv(all_files, csv_path)
        return

    # 2. Load existing files to avoid re-processing
    try:
        df = pd.read_csv(csv_path)
        existing_files = set(df['filepath'].astype(str))
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return

    # 3. Find NEW files only
    all_audio_files = list(folder_path.glob("**/*.wav"))
    new_files = [f for f in all_audio_files if f.name not in existing_files]

    if not new_files:
        print("No new files found. CSV is up to date.")
        return

    # 4. Process only the new files
    new_data = process_files(new_files)

    # 5. Append to existing CSV
    if new_data:
        new_df = pd.DataFrame(new_data)
        new_df.to_csv(csv_path, mode='a', header=False, index=False)
        print(f"✅ Added {len(new_df)} new entries to {csv_path}")

if __name__ == '__main__':
    # --- PATH SETUP ---
    SCRIPT_DIR = Path(__file__).parent.resolve()
    RECANVO_FOLDER = SCRIPT_DIR / "ReCANVo"
    CSV_FILE = "features.csv"

    # --- EXECUTION ---
    # We only call ONE function now. It handles both creation and updating.
    if RECANVO_FOLDER.exists():
        update_feature_csv(RECANVO_FOLDER, CSV_FILE)
    else:
        print(f"ReCANVo folder not found at {RECANVO_FOLDER}")
