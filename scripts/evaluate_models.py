"""Lee results/metrics.csv y responde las preguntas de hipotesis + lag."""
import os
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    m = pd.read_csv(os.path.join(ROOT, "results", "metrics.csv"))
    print(m.to_string(index=False))
    print("\n--- HYPOTESIS: ¿cortes agregan valor sobre clima+tiempo? ---")
    for tag in ["NAT", "GYA"]:
        a = m.loc[m["modelo"] == f"{tag}|HYP_clima", "MAE"]
        b = m.loc[m["modelo"] == f"{tag}|HYP_clima_cortes", "MAE"]
        if len(a) and len(b) and pd.notna(a.iloc[0]) and pd.notna(b.iloc[0]):
            better = "SI (B mejor)" if b.iloc[0] < a.iloc[0] else "NO (B no mejora)"
            print(f"  {tag}: clima MAE={a.iloc[0]:.1f}  clima+cortes MAE={b.iloc[0]:.1f}  -> {better}")
    lagp = os.path.join(ROOT, "results", "lag_effects.csv")
    if os.path.exists(lagp):
        lag = pd.read_csv(lagp)
        if len(lag):
            print("\n--- LAG: efecto max |efecto| por modalidad ---")
            for mod, sub in lag.groupby("modalidad"):
                i = sub["efecto"].abs().idxmax()
                r = sub.loc[i]
                print(f"  {mod}: lag={int(r['lag'])} efecto={r['efecto']:.4f} IC[{r['lo']:.4f},{r['hi']:.4f}]")


if __name__ == "__main__":
    main()
