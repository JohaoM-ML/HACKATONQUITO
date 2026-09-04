"""Los baselines se estiman en la misma corrida que el DLNM (split temporal identico)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_experiments

if __name__ == "__main__":
    run_experiments.main()
