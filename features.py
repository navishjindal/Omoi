import librosa
import numpy as np
import pandas as pd
import os
import tempfile
from pathlib import Path
from google.cloud import storage # Import GCS library
from audio_preprocessing import normalize_and_trim, SR

# --- Configuration Constants ---
N_MFCC = 40
N_FFT = 2048
HOP_LENGTH = 512

# ⚠️ UPDATE THIS WITH YOUR ACTUAL BUCKET NAME
BUCKET_NAME = "voicedata-csv"
PROJECT_ID = "peak-apparatus-479108-f5"
# Folder prefix inside the bucket (e.g., "ReCANVo/"). Leave empty "" if files are at root.
BUCKET_PREFIX = "ReCANVo/"

def extract_features(audio_path: str) -> np.ndarray:
    """
    Extracts purely technical features: MFCCs, Pitch, and Energy.
    """
    # 1. Preprocess the audio
    # audio_path here will be a temporary local path to the downloaded file
    y_trimmed, sr = normalize_and_trim(audio_path, SR)

    if y_trimmed.size == 0:
        return None

    #[cite_start]# [cite: 14] 2. Extract MFCCs
    mfccs = librosa.feature.mfcc(
        y=y_trimmed, sr=sr, n_mfcc=N_MFCC, n_fft=N_FFT, hop_length=HOP_LENGTH
    )

    #[cite_start]# [cite: 14] 3. Extract Energy (RMS)
    rms = librosa.feature.rms(
        y=y_trimmed, frame_length=N_FFT, hop_length=HOP_LENGTH
    )

    #[cite_start]# [cite: 14] 4. Extract Pitch (F0 using pYIN)
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

def process_gcs_blobs(blob_list: list) -> list:
    """
    Helper: Downloads GCS blobs to temp files, extracts features, and returns rows.
    FIXED for Windows: Closes the file handle before Librosa tries to read it.
    """
    processed_rows = []
    print(f"Processing {len(blob_list)} files from Cloud Storage...")

    for blob in blob_list:
        # We process only .wav files
        if not blob.name.lower().endswith('.wav'):
            continue

        temp_filename = None
        try:
            # 1. Create a temp file but DON'T keep it open
            # delete=False is crucial for Windows so we can close it and then re-open it with librosa
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio:
                temp_filename = temp_audio.name
                print(f"Downloading {blob.name}...")
                blob.download_to_filename(temp_filename)

            # 2. File is now closed, so Librosa can safely open it
            feature_vector = extract_features(temp_filename)

            if feature_vector is not None:
                row = {'filepath': blob.name}
                for i, val in enumerate(feature_vector):
                    row[f'feature_{i}'] = val
                processed_rows.append(row)

        except Exception as e:
            print(f"Error processing {blob.name}: {e}")

        finally:
            # 3. Manually clean up the file
            if temp_filename and os.path.exists(temp_filename):
                try:
                    os.remove(temp_filename)
                except PermissionError:
                    pass # Sometimes Windows holds on a bit too long; ignore simple cleanup errors

    return processed_rows

def update_feature_csv_from_cloud(bucket_name: str, prefix: str, csv_path: str = 'features.csv'):
    """
    Smart updater: Connects to GCS, checks against local CSV, downloads & processes ONLY new files.
    """
    csv_file = Path(csv_path)

    # 1. Initialize Google Cloud Storage Client
    try:
        storage_client = storage.Client(project=PROJECT_ID)
        bucket = storage_client.bucket(bucket_name)
        print(f"Connected to GCS Bucket: {bucket_name}")
    except Exception as e:
        print(f"❌ Failed to connect to GCS. Run 'gcloud auth application-default login'. Error: {e}")
        return

    # 2. Load existing CSV to find already processed files
    existing_files = set()
    if csv_file.exists():
        try:
            df = pd.read_csv(csv_path)
            # Ensure we compare strings to strings
            existing_files = set(df['filepath'].astype(str))
            print(f"Loaded {len(existing_files)} existing entries from {csv_path}")
        except Exception as e:
            print(f"Error reading CSV: {e}")
            return
    else:
        print(f"CSV not found. A new one will be created.")

    # 3. List Blobs in the Bucket
    print(f"Scanning bucket '{bucket_name}' for files...")
    # list_blobs returns an iterator
    blobs = list(bucket.list_blobs(prefix=prefix))

    # 4. Filter for NEW files only
    # We check if the blob name (e.g., 'ReCANVo/audio.wav') is in our existing set
    new_blobs = [b for b in blobs if b.name not in existing_files and b.name.endswith('.wav')]

    if not new_blobs:
        print("✅ No new files found in Cloud. CSV is up to date.")
        return

    # 5. Process the new blobs
    new_data = process_gcs_blobs(new_blobs)

    # 6. Save/Append to CSV
    if new_data:
        new_df = pd.DataFrame(new_data)

        if not csv_file.exists():
            # Create new file with header
            new_df.to_csv(csv_path, index=False)
            print(f"✅ Created {csv_path} with {len(new_df)} rows.")
        else:
            # Append without header
            new_df.to_csv(csv_path, mode='a', header=False, index=False)
            print(f"✅ Added {len(new_df)} new entries to {csv_path}")
    else:
        print("❌ No features extracted from new files.")

if __name__ == '__main__':
    # --- EXECUTION ---
    # Ensure you have run 'gcloud auth application-default login' in your terminal first!
    update_feature_csv_from_cloud(BUCKET_NAME, BUCKET_PREFIX)
