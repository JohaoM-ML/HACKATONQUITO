"""Pega casos_dengue Guayas 2026 (gaceta) en el dataset semanal. No toca NA de otros anios."""
import os
import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.path.join(ROOT, "data", "model", "ventana_seca_guayaquil_weekly.csv")
GY = os.path.join(ROOT, "data", "raw", "dengue_guayas_semanal_gaceta.csv")


def main():
    df = pd.read_csv(MODEL)
    gy = pd.read_csv(GY)
    if len(gy) > 40:
        raise RuntimeError(f"Serie Guayas sospechosamente larga ({len(gy)}). Revisa extract_dengue_pdf.py")
    gy = gy[["semana_id", "casos_dengue"]].rename(columns={"casos_dengue": "casos_g"})
    df["casos_dengue"] = np.nan
    df["casos_unidad"] = pd.Series([pd.NA] * len(df), dtype="object")
    df = df.drop(columns=[c for c in ["casos_g"] if c in df.columns], errors="ignore")
    df = df.merge(gy, on="semana_id", how="left")
    mask = df["casos_g"].notna()
    df.loc[mask, "casos_dengue"] = df.loc[mask, "casos_g"]
    df.loc[mask, "casos_unidad"] = "Guayas"
    df.drop(columns=["casos_g"], inplace=True)
    df.to_csv(MODEL, index=False)
    print("casos_dengue no-NA:", int(df["casos_dengue"].notna().sum()))


if __name__ == "__main__":
    main()
