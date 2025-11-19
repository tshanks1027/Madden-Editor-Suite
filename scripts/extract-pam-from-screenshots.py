import os
from PIL import Image
import pytesseract

# Set tesseract path if needed (Windows)
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

pam_dir = r"C:\Users\tshan\Documents\Dev\madden-editor-suite\data\PAM"
output_file = r"C:\Users\tshan\Documents\Dev\madden-editor-suite\data\PAM\extracted_pam_list.txt"

print("Extracting PAM names from screenshots...")

pam_names = set()

# Get all PNG files
screenshots = [f for f in os.listdir(pam_dir) if f.endswith('.png')]
print(f"Found {len(screenshots)} screenshots")

for i, screenshot in enumerate(sorted(screenshots), 1):
    print(f"Processing {i}/{len(screenshots)}: {screenshot}")

    img_path = os.path.join(pam_dir, screenshot)
    img = Image.open(img_path)

    # Extract text using OCR
    text = pytesseract.image_to_string(img)

    # Parse lines and extract PAM names
    for line in text.split('\n'):
        line = line.strip()
        if '_' in line and not line.startswith('gen_'):
            # Remove folder icons and clean up
            line = line.replace('►', '').replace('□', '').replace('▶', '').strip()
            if line:
                pam_names.add(line)

print(f"\nExtracted {len(pam_names)} unique PAM names")

# Write to file
with open(output_file, 'w', encoding='utf-8') as f:
    for pam in sorted(pam_names):
        f.write(pam + '\n')

print(f"Saved to: {output_file}")
