"""LLM loading and calling. The 7B Qwen serves every agent (as in the notebook's API); an optional 14B (4-bit)
can be loaded for the Query Builder / Grader with LLM_STRONG=14b. Torch/transformers are imported lazily."""
import json
import os
import re
import threading
import time

LLM_NAME = os.getenv("LLM_NAME", "Qwen/Qwen2.5-7B-Instruct")
STRONG_NAME = "Qwen/Qwen2.5-14B-Instruct"
GPU_LOCK = threading.Lock()                       # one analysis at a time on the GPU
USAGE = {"calls": 0, "in": 0, "out": 0, "sec": 0.0}
_m = {"small": None, "strong": None}              # {"tok":..., "model":...}


def _bnb():
    import torch
    from transformers import BitsAndBytesConfig
    return BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.float16,
                              bnb_4bit_use_double_quant=True)


def _load(name, force_4bit=False):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    gb = sum(torch.cuda.get_device_properties(i).total_memory for i in range(torch.cuda.device_count())) / 1e9
    use_4bit = force_4bit or os.getenv("LOAD_4BIT") == "1" or (os.getenv("LOAD_4BIT") != "0" and gb < 20)
    kw = dict(device_map="auto", quantization_config=_bnb()) if use_4bit else dict(torch_dtype=torch.float16, device_map="auto")
    tok = AutoTokenizer.from_pretrained(name)
    model = AutoModelForCausalLM.from_pretrained(name, **kw).eval()
    print(f"loaded {name} | 4bit={use_4bit} | GPU memory {gb:.0f} GB")
    return {"tok": tok, "model": model}


def load_models():
    _m["small"] = _load(LLM_NAME)
    if os.getenv("LLM_STRONG", "same") == "14b":
        _m["strong"] = _load(STRONG_NAME, force_4bit=True)


def _generate(slot, messages, max_new_tokens):
    import torch
    m = _m[slot] or _m["small"]
    tok, model = m["tok"], m["model"]
    text = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tok([text], return_tensors="pt").to(model.device)
    t0 = time.time()
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False)
    new = out[0][inputs.input_ids.shape[1]:]
    USAGE["calls"] += 1; USAGE["in"] += int(inputs.input_ids.shape[1]); USAGE["out"] += int(new.shape[0]); USAGE["sec"] += time.time() - t0
    return tok.decode(new, skip_special_tokens=True)


def ask(messages, max_new_tokens=512):
    return _generate("small", messages, max_new_tokens)


def llm(system, user, max_new_tokens=500):
    return ask([{"role": "system", "content": system}, {"role": "user", "content": user}], max_new_tokens).strip()


def llm_strong(system, user, max_new_tokens=500):
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    return _generate("strong", msgs, max_new_tokens).strip()      # falls back to the 7B if no 14B is loaded


def model_tag():
    return "14b" if _m["strong"] else "7b"


# ---- JSON helpers (notebook cell 120) ----
def parse_json(text):
    text = re.sub(r"```(?:json)?", "", text)
    s, e = text.find("{"), text.rfind("}")
    if s == -1 or e == -1:
        raise ValueError("no JSON found")
    return json.loads(text[s:e + 1])


def _json_call(fn, system, user, max_new_tokens, retries):
    raw = ""
    for attempt in range(retries + 1):
        suffix = "" if attempt == 0 else "\n\nReturn ONLY one valid JSON object, nothing else."
        try:
            raw = fn(system, user + suffix, max_new_tokens)
            return parse_json(raw), raw
        except Exception:
            continue
    return None, raw


def llm_json(system, user, max_new_tokens=500, retries=1):
    return _json_call(llm, system, user, max_new_tokens, retries)


def llm_json_strong(system, user, max_new_tokens=300, retries=1):   # Query Builder and Grader
    return _json_call(lambda s, u, n: llm_strong(s, u, n), system, user, max_new_tokens, retries)
