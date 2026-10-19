import json
from pathlib import Path

# Extracted programmatically from the notebook (cells 124 and 158); versions kept: parser v6, query_builder v2, grader v2.
PROMPTS = json.loads((Path(__file__).parent / "prompts.json").read_text(encoding="utf-8"))
