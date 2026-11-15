"""Writes tests/fixtures/12mp-gps.jpg: a 4000x3000 JPEG carrying EXIF GPS (Brisbane)."""
from PIL import Image, ImageDraw
import pathlib

out = pathlib.Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "12mp-gps.jpg"
img = Image.new("RGB", (4000, 3000))
d = ImageDraw.Draw(img)
for y in range(0, 3000, 50):
    d.rectangle([0, y, 4000, y + 50], fill=(y % 256, 80, 255 - y % 256))
d.ellipse([1500, 1000, 2500, 2000], fill=(245, 158, 11))
exif = Image.Exif()
exif[0x010F] = "TestCam"  # Make
gps = {1: "S", 2: (27.0, 28.0, 12.0), 3: "E", 4: (153.0, 1.0, 30.0)}
exif[0x8825] = gps
img.save(out, "JPEG", quality=70, exif=exif.tobytes())
print(out, out.stat().st_size)
