"""
Dependency Checker - Replaces excessive try/except import blocks.

Provides a centralized way to check and validate required dependencies
instead of masking import errors with try/except blocks throughout the code.
"""

import importlib
import sys
from typing import Dict, List, Optional, Set, Any
import subprocess


class DependencyChecker:
    """
    Centralized dependency checking and validation.

    Features:
    - Check required imports for different modes
    - Fail fast at startup for missing packages
    - Clear error messages with installation instructions
    - Optional package installation
    """

    # Define required packages by mode/component
    REQUIREMENTS = {
        'embedding': [
            'sentence_transformers>=2.2.0',
            'torch>=2.0.0',
            'numpy>=1.24.0'
        ],
        'faiss': [
            'faiss-cpu>=1.7.4'  # or faiss-gpu
        ],
        'reranking': [
            'FlagEmbedding>=1.2.0'
        ],
        'api': [
            'flask>=2.3.0',
            'pydantic>=2.0.0'
        ],
        'xml': [
            'lxml>=4.9.0',
            'defusedxml>=0.7.1'  # Security
        ],
        'data': [
            'pandas>=2.0.0'
        ],
        'security': [
            'defusedxml>=0.7.1',
            'python-dotenv>=1.0.0'
        ],
        'development': [
            'pytest>=7.0.0',
            'black>=23.0.0',
            'flake8>=6.0.0',
            'mypy>=1.0.0'
        ]
    }

    @classmethod
    def check_dependencies(cls, mode: str, exit_on_error: bool = True) -> bool:
        """
        Check required imports for specified mode.

        Args:
            mode: Mode to check ('embedding', 'faiss', 'reranking', etc.)
            exit_on_error: Whether to exit the program if dependencies are missing

        Returns:
            True if all dependencies are available, False otherwise
        """
        missing_packages = []

        # Get required packages for mode
        required_packages = cls.REQUIREMENTS.get(mode, [])

        for package_spec in required_packages:
            package_name = cls._extract_package_name(package_spec)
            if not cls._check_package_available(package_name):
                missing_packages.append(package_spec)

        if missing_packages:
            cls._report_missing_packages(missing_packages, mode, exit_on_error)
            return False

        print(f"✅ All dependencies for '{mode}' mode are available")
        return True

    @classmethod
    def check_import(cls, package: str) -> bool:
        """
        Check if a specific package can be imported.

        Args:
            package: Package name to check

        Returns:
            True if package can be imported, False otherwise
        """
        try:
            importlib.import_module(package)
            return True
        except ImportError:
            return False

    @classmethod
    def _extract_package_name(cls, package_spec: str) -> str:
        """Extract package name from package specification."""
        # Handle version specifiers: 'package>=1.0.0' -> 'package'
        package_name = package_spec.split('>=')[0].split('==')[0].split('<=')[0].split('<')[0].split('>')[0].split('!')[0].split('~')[0].split(';')[0].split(',')[0].strip()
        return package_name

    @classmethod
    def _check_package_available(cls, package_name: str) -> bool:
        """Check if package is available in current environment."""
        return cls.check_import(package_name)

    @classmethod
    def _report_missing_packages(cls, missing_packages: List[str], mode: str, exit_on_error: bool) -> None:
        """Report missing packages with installation instructions."""
        print(f"❌ Missing packages for '{mode}' mode:")
        for package in missing_packages:
            print(f"   - {package}")

        print(f"\n💡 To install missing packages:")
        print(f"   pip install {' '.join(missing_packages)}")

        # Also suggest installing all requirements for the mode
        all_requirements = ' '.join(cls.REQUIREMENTS.get(mode, []))
        if all_requirements:
            print(f"   # Or install all requirements for {mode} mode:")
            print(f"   pip install {all_requirements}")

        if exit_on_error:
            print(f"\n🔴 Exiting due to missing dependencies for '{mode}' mode")
            sys.exit(1)

    @classmethod
    def install_missing_packages(cls, missing_packages: List[str]) -> bool:
        """
        Attempt to install missing packages.

        Args:
            missing_packages: List of package specifications to install

        Returns:
            True if installation succeeded, False otherwise
        """
        if not missing_packages:
            return True

        print(f"🔄 Attempting to install {len(missing_packages)} missing packages...")

        try:
            # Use pip to install packages
            cmd = [sys.executable, '-m', 'pip', 'install'] + missing_packages
            result = subprocess.run(cmd, capture_output=True, text=True)

            if result.returncode == 0:
                print("✅ Successfully installed missing packages")
                print("   Note: You may need to restart the application")
                return True
            else:
                print(f"❌ Failed to install packages: {result.stderr}")
                return False

        except Exception as e:
            print(f"❌ Error during package installation: {e}")
            return False

    @classmethod
    def get_missing_dependencies(cls, mode: str) -> List[str]:
        """
        Get list of missing dependencies for a mode without reporting.

        Args:
            mode: Mode to check

        Returns:
            List of missing package specifications
        """
        missing_packages = []
        required_packages = cls.REQUIREMENTS.get(mode, [])

        for package_spec in required_packages:
            package_name = cls._extract_package_name(package_spec)
            if not cls._check_package_available(package_name):
                missing_packages.append(package_spec)

        return missing_packages

    @classmethod
    def validate_environment(cls) -> Dict[str, bool]:
        """
        Validate the current environment for all modes.

        Returns:
            Dictionary mapping mode names to availability status
        """
        results = {}
        for mode in cls.REQUIREMENTS.keys():
            results[mode] = cls.check_dependencies(mode, exit_on_error=False)
        return results


def check_and_import(package: str, mode: str = "unknown") -> Optional[Any]:
    """
    Check dependency and import package, providing clear error messages.

    Args:
        package: Package name to import
        mode: Mode name for error reporting

    Returns:
        Imported module if successful, None otherwise
    """
    if not DependencyChecker.check_import(package):
        print(f"❌ Failed to import '{package}' required for {mode} mode")
        print(f"💡 Install with: pip install {package}")
        return None

    try:
        return importlib.import_module(package)
    except Exception as e:
        print(f"❌ Error importing '{package}': {e}")
        return None


def require_dependencies(*modes: str) -> None:
    """
    Require that dependencies for specified modes are available.
    Exits the program if dependencies are missing.

    Args:
        *modes: Mode names that must be available

    Example:
        require_dependencies('embedding', 'faiss')
    """
    for mode in modes:
        DependencyChecker.check_dependencies(mode, exit_on_error=True)


# Convenience functions for common dependency checks
def check_embedding_deps() -> bool:
    """Check embedding dependencies."""
    return DependencyChecker.check_dependencies('embedding', exit_on_error=False)

def check_faiss_deps() -> bool:
    """Check FAISS dependencies."""
    return DependencyChecker.check_dependencies('faiss', exit_on_error=False)

def check_reranking_deps() -> bool:
    """Check reranking dependencies."""
    return DependencyChecker.check_dependencies('reranking', exit_on_error=False)

def check_api_deps() -> bool:
    """Check API dependencies."""
    return DependencyChecker.check_dependencies('api', exit_on_error=False)