"""Entrena la bateria DLNM + GLM (equiv. INLA 1-serie). Ver run_experiments.py."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_experiments

if __name__ == "__main__":
    run_experiments.main()
