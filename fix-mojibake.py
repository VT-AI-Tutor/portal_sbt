#!/usr/bin/env python3
"""Fix mojibake in SessionResult.tsx.

The file on disk contains mojibake text stored as valid UTF-8. To recover the
original Vietnamese text, we read the file as UTF-8, then re-encode each
character as Latin-1 (the encoding that produced the mojibake in the first
place), giving us the original UTF-8 byte sequence.

Characters already in the correct range (> 255, e.g. emoji) are kept as their
UTF-8 encoding.
"""
import sys
from pathlib import Path

path = Path(sys.argv[1])
raw = path.read_bytes()
# Strip UTF-8 BOM if present
if raw.startswith(b"\xef\xbb\xbf"):
    raw = raw[3:]
text = raw.decode("utf-8")

out = bytearray()
for ch in text:
    cp = ord(ch)
    if cp <= 0xFF:
        # Mojibake char: re-encode as Latin-1 to recover original UTF-8 byte.
        out.append(cp)
    else:
        # Already-correct char (e.g. emoji): encode as UTF-8.
        out.extend(ch.encode("utf-8"))

path.write_bytes(bytes(out))
print(f"Fixed: {path}")
