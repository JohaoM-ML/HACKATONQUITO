"""Agrega eventos Interagua a serie semanal. Delega en clean_cortes + build_dataset."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import clean_cortes
import build_dataset

if __name__ == "__main__":
    clean_cortes.main()
    build_dataset.main()
