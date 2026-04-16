from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from ml_pipeline import get_model_bundle


def main() -> None:
    bundle = get_model_bundle(force_retrain=True)
    summary = {
        "version": bundle["version"],
        "dataset_source": bundle["dataset_source"],
        "trained_at": bundle["trained_at"],
        "metrics": bundle["metrics"],
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
