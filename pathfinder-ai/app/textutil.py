import re


def strip_label(t):
    return re.sub(r"^\[[^\]]*\]\s*", "", str(t))


def _sig(text):
    return re.sub(r"\W+", " ", strip_label(text)).strip().lower()[:150]


_STOP = set("a an the and or of to in for with on at by from as is are be this that you we our your will can "
            "have has it its their they who which not all any each per etc".split())


def tokenize(text):
    toks = re.findall(r"[a-z0-9][a-z0-9+#.]*", strip_label(text).lower())
    return [t.rstrip(".") for t in toks if t.rstrip(".") not in _STOP and len(t.rstrip(".")) > 1]


def esc(s):
    import html
    return html.escape(str(s if s is not None else ""))
