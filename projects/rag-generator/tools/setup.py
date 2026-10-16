#!/usr/bin/env python3
"""
Environment setup script for Lore RAG system.

Handles initial project configuration and data validation.
"""

import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def create_data_symlink():
    """Create symlink to existing lore data."""
    project_root = Path(__file__).parent.parent
    rag_manual_dir = project_root / "rag-manual"
    data_dir = project_root / "data"

    if not rag_manual_dir.exists():
        print(f"Warning: {rag_manual_dir} not found. Please ensure rag-manual/ exists.")
        return

    if not data_dir.exists():
        try:
            # Create data directory structure
            data_dir.mkdir()
            (data_dir / "lore_md").mkdir()

            # Create symlink to corpus directory
            lore_source = project_root / "corpus"
            lore_target = data_dir / "lore_md" / "corpus"

            if sys.platform == "win32":
                # Windows symlink creation
                import subprocess
                subprocess.run([
                    "cmd", "/c", "mklink", "/D",
                    str(lore_target), str(lore_source)
                ], check=True)
            else:
                # Unix symlink creation
                lore_target.symlink_to(lore_source, target_is_directory=True)

            print(f"✓ Created symlink: {lore_target} -> {lore_source}")

        except Exception as e:
            print(f"Warning: Could not create data symlink: {e}")
            print("You may need to manually copy or symlink the corpus directory from root")


def validate_config_files():
    """Validate that all required configuration files exist."""
    config_files = [
        "config/ingestion.xml",
        "config/index.xml",
        "config/api.xml",
        "config/generator.xml",
        "config/rag.xml"
    ]

    missing_files = []
    for config_file in config_files:
        if not Path(config_file).exists():
            missing_files.append(config_file)

    if missing_files:
        print(f"Error: Missing configuration files: {missing_files}")
        return False

    print("✓ All configuration files present")
    return True


def check_python_version():
    """Check Python version compatibility."""
    required_version = (3, 8)
    current_version = sys.version_info[:2]

    if current_version < required_version:
        print(f"Error: Python {required_version[0]}.{required_version[1]}+ required, "
              f"found {current_version[0]}.{current_version[1]}")
        return False

    print(f"✓ Python {current_version[0]}.{current_version[1]} OK")
    return True


def create_store_directory():
    """Ensure store directory exists and is empty."""
    store_dir = Path("store")
    store_dir.mkdir(exist_ok=True)

    # Clean any existing files (from previous runs)
    for file in store_dir.iterdir():
        if file.is_file():
            file.unlink()

    print("✓ Store directory ready")


def main():
    """Main setup process."""
    print("🚀 Setting up Lore RAG System")
    print("=" * 50)

    steps = [
        ("Python version check", check_python_version),
        ("Configuration validation", validate_config_files),
        ("Data directory setup", create_data_symlink),
        ("Store directory preparation", create_store_directory),
    ]

    all_passed = True
    for step_name, step_func in steps:
        print(f"\n📋 {step_name}...")
        try:
            if not step_func():
                all_passed = False
        except Exception as e:
            print(f"❌ {step_name} failed: {e}")
            all_passed = False

    print("\n" + "=" * 50)
    if all_passed:
        print("✅ Setup completed successfully!")
        print("\nNext steps:")
        print("1. Run 'make ingest' to process lore files")
        print("2. Run 'make embed' to generate embeddings")
        print("3. Run 'make index' to build search index")
        print("4. Run 'make retrieve' to start the API server")
    else:
        print("❌ Setup failed. Please resolve issues above.")
        sys.exit(1)


if __name__ == "__main__":
    main()