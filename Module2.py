# module2_train_emotion_model.py

import os
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
import joblib

# ===== 1) Load labeled features =====
file_path = r"C:\Users\rohan\OneDrive\Desktop\Datathon\features_labeled.csv"
df = pd.read_csv(file_path)

print("First 5 rows of merged data:")
print(df.head())

# ===== 2) Extract feature columns =====
feature_cols = [c for c in df.columns if c.startswith("feature_")]

X = df[feature_cols].values
y = df["label"].values

################################################# accuracy checker
from sklearn.model_selection import cross_val_score

print("\n=== 5-Fold Cross Validation (SVM Baseline) ===")
cv_model = SVC(kernel="rbf", probability=True)

scores = cross_val_score(cv_model, X, y, cv=5)
print("Fold scores:", scores)
print("Average CV accuracy:", scores.mean())
print("Std deviation:", scores.std())

############################

print(f"\nTotal samples: {len(y)}")
print(f"Feature dimensions: {X.shape[1]}")
print(f"Label classes: {set(y)}")

# ===== 3) Train/validation split =====
X_train, X_val, y_train, y_val = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print(f"\nTrain samples: {len(y_train)}")
print(f"Validation samples: {len(y_val)}")

# ===== 4) Save train and test splits as CSV for easy inspection =====
train_df = pd.DataFrame(X_train, columns=feature_cols)
train_df["label"] = y_train
train_df.to_csv(r"C:\Users\rohan\OneDrive\Desktop\Datathon\train_data.csv", index=False)

test_df = pd.DataFrame(X_val, columns=feature_cols)
test_df["label"] = y_val
test_df.to_csv(r"C:\Users\rohan\OneDrive\Desktop\Datathon\test_data.csv", index=False)

print("\n📁 Saved: train_data.csv and test_data.csv")

# ===== 5) Scaling =====
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_val_scaled   = scaler.transform(X_val)

# ===== 6) Baseline model: SVM =====
svm_model = SVC(kernel="rbf", probability=True, random_state=42)
svm_model.fit(X_train_scaled, y_train)
y_pred_svm = svm_model.predict(X_val_scaled)

baseline_acc = np.mean(y_pred_svm == y_val)
print("\n=== Baseline Model: SVM ===")
print(classification_report(y_val, y_pred_svm))
print("Confusion Matrix (SVM):")
print(confusion_matrix(y_val, y_pred_svm))
print(f"SVM accuracy: {baseline_acc:.3f}")

# ===== 7) Improved model: MLP Neural Network =====
mlp_model = MLPClassifier(
    hidden_layer_sizes=(128, 64),
    activation="relu",
    max_iter=300,
    random_state=42,
)
mlp_model.fit(X_train_scaled, y_train)
y_pred_mlp = mlp_model.predict(X_val_scaled)

improved_acc = np.mean(y_pred_mlp == y_val)
print("\n=== Improved Model: MLP ===")
print(classification_report(y_val, y_pred_mlp))
print("Confusion Matrix (MLP):")
print(confusion_matrix(y_val, y_pred_mlp))
print(f"MLP accuracy: {improved_acc:.3f}")

# ===== 8) Pick best model =====
if improved_acc >= baseline_acc:
    print("\n✅ Using IMPROVED model (MLP)")
    final_model = mlp_model
else:
    print("\n✅ Using BASELINE model (SVM)")
    final_model = svm_model

# ===== 9) Save model + scaler =====
models_dir = r"C:\Users\rohan\OneDrive\Desktop\Datathon\models"
os.makedirs(models_dir, exist_ok=True)

model_path  = os.path.join(models_dir, "emotion_model.pkl")
scaler_path = os.path.join(models_dir, "scaler.pkl")

joblib.dump(final_model, model_path)
joblib.dump(scaler, scaler_path)

with open(os.path.join(models_dir, "feature_cols.txt"), "w") as f:
    for c in feature_cols:
        f.write(c + "\n")

print(f"\n💾 Saved model to: {model_path}")
print(f"💾 Saved scaler to: {scaler_path}")
print("🎉 Module 2 training complete!")
