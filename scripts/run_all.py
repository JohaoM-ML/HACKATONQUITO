"""
run_all.py — VENTANA SECA
Orquesta la construccion completa del dataset de forma reproducible.
    python scripts/run_all.py
"""
import subprocess, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEPS = [
    "scripts/download_climate.py",
    "scripts/download_dengue_opendengue.py",
    "scripts/clean_cortes.py",
    "scripts/build_dataset.py",
]


def main():
    for s in STEPS:
        print("\n" + "=" * 60 + f"\n>>> {s}\n" + "=" * 60)
        r = subprocess.run([sys.executable, os.path.join(ROOT, s)], cwd=ROOT)
        if r.returncode != 0:
            print(f"FALLO en {s}"); sys.exit(1)
    print("\nOK. Dataset final en data/model/ventana_seca_guayaquil_weekly.csv")


if __name__ == "__main__":
    main()
