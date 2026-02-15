
from PIL import Image
import os

files = ['saver.webp', 'comfort.webp', 'vip.webp', 'taxi.webp', 'scooter.webp']
base_path = r'e:\sm-new\smart-v2\smartline-app\src\assets\images'

for f in files:
    path = os.path.join(base_path, f)
    if os.path.exists(path):
        try:
            img = Image.open(path)
            print(f"{f}: Mode={img.mode}, Size={img.size}")
            # Check corners for color
            corners = [
                img.getpixel((0, 0)),
                img.getpixel((img.width-1, 0)),
                img.getpixel((0, img.height-1)),
                img.getpixel((img.width-1, img.height-1))
            ]
            print(f"  Corners: {corners}")
        except Exception as e:
            print(f"  Error reading {f}: {e}")
    else:
        print(f"{f} not found")
