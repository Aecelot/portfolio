#!/usr/bin/env python3
"""
RAG Demo Runner - Fixed version for execution from project root
"""

import sys
import os

# Add the project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# Now import and run the RAG demo
from src.rag.rag_demo import main

if __name__ == "__main__":
    exit(main())