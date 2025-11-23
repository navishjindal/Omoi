import librosa
import numpy as np
import soundfile as sf
import os
import tempfile
import glob
from scipy.signal import butter, lfilter
from google.cloud import storage
from pathlib import Path

# --- Configuration Constants ---
# ⚠️ Replace 'raw_recordings' with the path to your local folder containing the audio files you want to upload
LOCAL_SOURCE_FOLDER = "raw_recordings"

SR = 22050
PROJECT_ID = "peak-apparatus-479108-f5"
BUCKET_NAME = "voicedata-csv"
DESTINATION_FOLDER = "ReCANVo/"

# --- Preprocessing Logic ---
def _basic_denoise(y: np.ndarray, sr: int) -> np.ndarray:
    """Applies a high-pass Butterworth filter for basic noise reduction."""
    cutoff_freq = 100
    nyq = 0.5 * sr
    normalized_cutoff = cutoff_freq / nyq
    b, a = butter(5, normalized_cutoff, btype='highpass', analog=False)
    return lfilter(b, a, y)

def normalize_and_trim(audio_path: str, sr: int = SR) -> tuple[np.ndarray, int]:
    """
    Loads audio, normalizes volume, trims silence, and denoises.
    """
    try:
        # Load with original SR first
        y, original_sr = librosa.load(audio_path, sr=None)

        # Resample if necessary
        if original_sr != sr:
            y = librosa.resample(y, orig_sr=original_sr, target_sr=sr)

        # Normalize (Volume)
        y = librosa.util.normalize(y)

        # Trim Silence (Top 20dB)
        y_trimmed, _ = librosa.effects.trim(y, top_db=20)

        # Denoise
        y_filtered = _basic_denoise(y_trimmed, sr)

        return y_filtered, sr

    except Exception as e:
        print(f"Error loading {audio_path}: {e}")
        return np.array([]), sr

# --- Cloud Upload Logic ---
def process_and_upload(local_file_path: str):
    """
    1. Reads local file.
    2. Trims & Denoises it.
    3. Uploads the CLEAN version to Google Cloud Storage.
    """
    file_path = Path(local_file_path)
    if not file_path.exists():
        print(f"❌ File not found: {local_file_path}")
        return

    print(f"🔹 Processing {file_path.name}...")

    # 1. Transform: Process the audio
    y_processed, sr = normalize_and_trim(str(file_path), SR)

    if y_processed.size == 0:
        print(f"❌ Processing failed for {file_path.name} (Audio empty or corrupt)")
        return

    # 2. Save processed audio to a temporary file
    try:
        # Create temp file, write audio, then close it so GCS can read it
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
            temp_path = temp_wav.name
            sf.write(temp_path, y_processed, sr)

        # 3. Load: Upload to Google Cloud
        storage_client = storage.Client(project=PROJECT_ID)
        bucket = storage_client.bucket(BUCKET_NAME)

        # Define destination path (e.g., ReCANVo/filename.wav)
        blob_name = f"{DESTINATION_FOLDER}{file_path.name}"
        blob = bucket.blob(blob_name)

        print(f"☁️ Uploading to gs://{BUCKET_NAME}/{blob_name}...")
        blob.upload_from_filename(temp_path)
        print("✅ Upload Complete!")

    except Exception as e:
        print(f"❌ Error during upload: {e}")

    finally:
        # 4. Clean up local temp file
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    # --- Main Execution Loop ---

    # 1. Verify source folder exists
    if not os.path.exists(LOCAL_SOURCE_FOLDER):
        print(f"⚠️ Warning: Folder '{LOCAL_SOURCE_FOLDER}' not found.")
        print("Please create this folder and put your wav files inside, or update LOCAL_SOURCE_FOLDER in the code.")
    else:
        # 2. Find all .wav files in the folder (recursive search)
        # Using glob to match any .wav file in the directory
        wav_files = glob.glob(os.path.join(LOCAL_SOURCE_FOLDER, "*.wav"))

        if not wav_files:
            print(f"No .wav files found in '{LOCAL_SOURCE_FOLDER}'.")
        else:
            print(f"Found {len(wav_files)} audio files. Starting batch upload...")

            for file_path in wav_files:
                process_and_upload(file_path)

            print("\n🎉 Batch upload finished.")
