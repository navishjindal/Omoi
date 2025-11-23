# Omoi 🎙️✨

**Voice for everyone.**

Omoi is a next-generation **Augmentative and Alternative Communication (AAC)** platform designed to empower non-verbal autistic individuals. By combining traditional symbol-based communication with **multimodal AI**, Amplify bridges the gap between intent, raw vocalization, and clear, natural speech.

---

## 🚀 The Mission

Traditional AAC devices are often slow, robotic, and lack nuance. A user clicks "Want" -> "Apple", and the device says "I want apple" in a monotone voice.

**Amplify is different.**

We believe communication is more than just words; it is emotion, tone, and urgency. Amplify uses **Generative AI** to listen to the sounds a non-verbal person makes (vocalizations, grunts, hums, or excited sounds) and combines them with selected symbols to determine **intent and emotion**.

If a user selects the **[Play]** icon while making an excited vocalization, Amplify doesn't just say "Play." It generates:
> *"I really want to go play right now!"* (Spoken in an excited, natural voice).

---

## 🌍 UN Sustainable Development Goals (SDGs)

Omoi is built with a global vision to reduce barriers and foster inclusivity, directly aligning with the **United Nations 17 Sustainable Development Goals**:

### 🎯 Goal 10: Reduced Inequalities
By providing a tool that allows neurodivergent individuals to communicate as fast and seamlessly as neurotypical individuals, we are dismantling the social and technological barriers that lead to exclusion.

### 🎯 Goal 3: Good Health and Well-being
Communication is fundamental to mental health. Reducing the frustration of being misunderstood drastically lowers anxiety and behavioral outbursts, promoting better emotional well-being for users and caregivers.

### 🎯 Goal 4: Quality Education
Inclusive education requires inclusive tools. Omoi allows non-verbal students to participate in classrooms, ask questions, and socialize with peers effectively.

---

## 🧠 How It Works: The "Magic" Logic

Omoi uses a sophisticated pipeline to transform simple inputs into complex, human conversations:

1.  **Background Audio Recording (The "Ear"):**
    *   From the moment the app starts, it listens. It captures the user's environment and their specific vocalizations using a high-fidelity WAV encoder.
    *   This audio captures **prosody**—the rhythm, stress, and intonation of speech—even if no actual words are spoken.

2.  **Symbol Selection (The "Context"):**
    *   The user interacts with a modern, simplified grid of pragmatic AAC symbols (e.g., "Hungry", "Play", "Outside").
    *   **Smart Prediction:** Using an LLM, the board predicts the next most likely symbols based on the current context, reducing the cognitive load and physical effort required to build a sentence.

3.  **Multimodal Fusion (The "Brain"):**
    *   We send both the **selected symbols** AND the **raw audio blob** to **Google Gemini 2.5**.
    *   The AI analyzes the audio to detect emotion (e.g., frustration, joy, urgency) and combines it with the symbols.
    *   It constructs a natural, grammatically correct sentence that matches the user's emotional state.

4.  **High-Fidelity TTS (The "Voice"):**
    *   The generated text is converted into audio using **AI Text-to-Speech** (powered by Gemini 2.5 Flash TTS / ElevenLabs class models).
    *   The result is a human-sounding voice that carries the intended emotion, allowing the user to mask comfortably and contribute to conversations naturally.

---

## 🛠️ Features

*   **Smart Suggestions:** An AI prediction engine that dynamically highlights the next logical words (e.g., clicking "Eat" suggests specific foods).
*   **Multimodal Input:** Interprets non-verbal sounds alongside touch input.
*   **Swipe Navigation:** Modern, gesture-based UI designed for motor accessibility.
*   **Visual Feedback:** Real-time audio wave visualization lets the user know they are being heard.
*   **Aesthetic UI:** Designed with soft pastels and rounded corners to be sensory-friendly and visually appealing.
*   **Eye Tracking:** Built-in gaze tracking for hands-free navigation.

---

## 💻 Tech Stack

*   **Frontend:** React 19, TypeScript, Tailwind CSS (via CDN)
*   **AI Core:** Google Gemini 2.5 Flash (Multimodal capabilities)
*   **Voice Generation:** Gemini 2.5 Flash TTS
*   **Audio Processing:** Web Audio API (ScriptProcessorNode for WAV encoding)
*   **Data Processing:** Python (Pandas, Scikit-learn) for emotion model training
*   **Icons:** Lucide React & Standard Emojis (for universal recognition)

---

## 📦 Installation & Setup

### Prerequisites
*   Node.js (v18 or higher)
*   Python 3.8+ (for model training scripts)
*   Google Gemini API Key

### 1. Clone the repository
```bash
git clone https://github.com/ammarjmahmood/Amplify.git
cd Amplify
```

### 2. Frontend Setup
Install the dependencies and start the development server:

```bash
npm install
npm run dev
```

### 3. Python Environment (Optional - For Model Training)
If you wish to work with the emotion recognition models (`Module2.py`, etc.):

```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install pandas numpy scikit-learn joblib
```

### 4. Configure API Key
*   Create a `.env` file in the root directory.
*   Add your Google Gemini API key:
```env
API_KEY=your_google_api_key_here
```

---

## 🔮 Future Vision

We aim to integrate **personalized voice cloning**, allowing users to upload a sample of their own vocalizations (or a family member's voice) to create a unique synthetic voice that feels like *theirs*, further solidifying their identity and independence.

> *Omoi: Because everyone deserves to be heard.*
