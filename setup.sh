#!/bin/bash
# Setup script for Madden Draft Prospect Scraper

echo "Setting up Madden Draft Prospect Scraper..."
echo "=========================================="

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Create output directory
echo "Creating output directory..."
mkdir -p output

# Create log directory
echo "Creating log directory..."
mkdir -p logs

echo ""
echo "Setup complete!"
echo ""
echo "To get started:"
echo "  1. Activate the virtual environment: source venv/bin/activate"
echo "  2. Run the scraper: python src/main.py --years 2026"
echo "  3. Check the output directory for results: output/"
echo ""
echo "For more information, see QUICKSTART.md"
