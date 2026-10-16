#!/usr/bin/env python3
"""
Real-time KPI Data Collection and Aggregation Module
===================================================

This module provides real-time collection, aggregation, and storage of 
KPI metrics for the Lore RAG system.
"""

import json
import time
import threading
import logging
import os
import platform
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from collections import deque
import psutil

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class KPICollector:
    """
    Real-time KPI data collector and aggregator.
    
    Collects system metrics, FAISS performance data, and aggregates
    historical trends for dashboard consumption.
    """
    
    def __init__(self, 
                 collection_interval: int = 60,  # seconds
                 history_retention: int = 86400,  # 24 hours
                 storage_path: str = "kpi_data"):
        """
        Initialize the KPI collector.
        
        Args:
            collection_interval: How often to collect metrics (seconds)
            history_retention: How long to retain historical data (seconds)
            storage_path: Directory to store KPI data files
        """
        self.collection_interval = collection_interval
        self.history_retention = history_retention
        self.storage_path = storage_path
        
        # In-memory storage for recent metrics
        self.current_metrics = {}
        self.historical_data = deque(maxlen=1440)  # 24 hours at 1-minute intervals
        
        # Threading control
        self.collection_thread = None
        self.running = False
        self.lock = threading.Lock()
        
        # Ensure storage directory exists
        os.makedirs(storage_path, exist_ok=True)
        
        # Load existing historical data
        self._load_historical_data()
    
    def start_collection(self):
        """Start the real-time KPI collection process."""
        if self.running:
            logger.warning("KPI collection already running")
            return
            
        self.running = True
        self.collection_thread = threading.Thread(target=self._collection_loop, daemon=True)
        self.collection_thread.start()
        logger.info(f"Started KPI collection with {self.collection_interval}s interval")
    
    def stop_collection(self):
        """Stop the KPI collection process."""
        self.running = False
        if self.collection_thread:
            self.collection_thread.join(timeout=5)
        logger.info("Stopped KPI collection")
    
    def get_current_metrics(self) -> Dict[str, Any]:
        """Get the most recent KPI metrics."""
        with self.lock:
            return self.current_metrics.copy() if self.current_metrics else self._get_default_metrics()
    
    def get_historical_data(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get historical KPI data for the specified time range."""
        with self.lock:
            cutoff_time = time.time() - (hours * 3600)
            return [
                data for data in self.historical_data 
                if data.get('timestamp', 0) > cutoff_time
            ]
    
    def force_collection(self) -> Dict[str, Any]:
        """Force an immediate KPI collection and return the results."""
        metrics = self._collect_metrics()
        with self.lock:
            self.current_metrics = metrics
        return metrics
    
    def _collection_loop(self):
        """Main collection loop running in background thread."""
        while self.running:
            try:
                metrics = self._collect_metrics()
                
                with self.lock:
                    self.current_metrics = metrics
                    self.historical_data.append(metrics)
                
                # Persist data periodically
                self._save_historical_data()
                
                logger.debug(f"Collected KPI metrics: latency={metrics.get('accuracy_metrics', {}).get('query_latency_ms', 'N/A')}ms")
                
            except Exception as e:
                logger.error(f"Error collecting KPI metrics: {e}")
                
            # Wait for next collection interval
            time.sleep(self.collection_interval)
    
    def _collect_metrics(self) -> Dict[str, Any]:
        """Collect current system and RAG metrics."""
        timestamp = time.time()
        
        metrics = {
            'timestamp': timestamp,
            'collection_time': datetime.fromtimestamp(timestamp).isoformat(),
            'accuracy_metrics': self._collect_accuracy_metrics(),
            'resource_metrics': self._collect_resource_metrics(),
            'performance_metrics': self._collect_performance_metrics(),
            'system_metrics': self._collect_system_metrics()
        }
        
        return metrics
    
    def _collect_accuracy_metrics(self) -> Dict[str, float]:
        """Collect FAISS accuracy and retrieval metrics."""
        try:
            # Try to load existing FAISS KPI report
            kpi_report_path = "faiss_kpi_report.json"
            if os.path.exists(kpi_report_path):
                with open(kpi_report_path, 'r', encoding='utf-8') as f:
                    kpi_data = json.load(f)
                    
                accuracy_metrics = kpi_data.get('accuracy_metrics', {})
                return {
                    'overlap_at_10': float(accuracy_metrics.get('overlap_at_10', 0.0)),
                    'recall_at_5': float(accuracy_metrics.get('recall_at_5', 0.0)),
                    'mean_reciprocal_rank': float(accuracy_metrics.get('mean_reciprocal_rank', 0.0)),
                    'query_latency_ms': float(accuracy_metrics.get('query_latency_ms', 0.0))
                }
            else:
                # Try to generate fresh metrics if evaluator is available
                return self._generate_fresh_accuracy_metrics()
                
        except Exception as e:
            logger.debug(f"Could not collect accuracy metrics: {e}")
            return {
                'overlap_at_10': 0.0,
                'recall_at_5': 0.0,
                'mean_reciprocal_rank': 0.0,
                'query_latency_ms': 0.0
            }
    
    def _generate_fresh_accuracy_metrics(self) -> Dict[str, float]:
        """Generate fresh accuracy metrics using FAISS evaluator."""
        try:
            from index.faiss_evaluator import run_faiss_kpi_evaluation
            
            index_path = "store/faiss.index"
            kpi_report_path = "faiss_kpi_report.json"
            
            if os.path.exists(index_path):
                # Run evaluation but don't let it block for too long
                run_faiss_kpi_evaluation(index_path, kpi_report_path)
                
                # Load the fresh results
                with open(kpi_report_path, 'r', encoding='utf-8') as f:
                    kpi_data = json.load(f)
                    
                accuracy_metrics = kpi_data.get('accuracy_metrics', {})
                return {
                    'overlap_at_10': float(accuracy_metrics.get('overlap_at_10', 0.0)),
                    'recall_at_5': float(accuracy_metrics.get('recall_at_5', 0.0)),
                    'mean_reciprocal_rank': float(accuracy_metrics.get('mean_reciprocal_rank', 0.0)),
                    'query_latency_ms': float(accuracy_metrics.get('query_latency_ms', 0.0))
                }
            else:
                return {
                    'overlap_at_10': 0.0,
                    'recall_at_5': 0.0,
                    'mean_reciprocal_rank': 0.0,
                    'query_latency_ms': 0.0
                }
                
        except Exception as e:
            logger.debug(f"Could not generate fresh accuracy metrics: {e}")
            return {
                'overlap_at_10': 0.0,
                'recall_at_5': 0.0,
                'mean_reciprocal_rank': 0.0,
                'query_latency_ms': 0.0
            }
    
    def _collect_resource_metrics(self) -> Dict[str, float]:
        """Collect resource usage metrics."""
        try:
            # Get FAISS index size
            index_size_mb = 0.0
            index_path = "store/faiss.index"
            if os.path.exists(index_path):
                index_size_mb = os.path.getsize(index_path) / (1024 * 1024)
            
            # Get memory usage (process-specific)
            process = psutil.Process()
            memory_info = process.memory_info()
            memory_usage_mb = memory_info.rss / (1024 * 1024)
            
            # Get build time from KPI report if available
            build_time_seconds = 0.0
            kpi_report_path = "faiss_kpi_report.json"
            if os.path.exists(kpi_report_path):
                try:
                    with open(kpi_report_path, 'r', encoding='utf-8') as f:
                        kpi_data = json.load(f)
                        resource_metrics = kpi_data.get('resource_metrics', {})
                        build_time_seconds = float(resource_metrics.get('build_time_seconds', 0.0))
                except Exception:
                    pass
            
            return {
                'memory_usage_mb': memory_usage_mb,
                'index_size_mb': index_size_mb,
                'build_time_seconds': build_time_seconds
            }
            
        except Exception as e:
            logger.debug(f"Could not collect resource metrics: {e}")
            return {
                'memory_usage_mb': 0.0,
                'index_size_mb': 0.0,
                'build_time_seconds': 0.0
            }
    
    def _collect_performance_metrics(self) -> Dict[str, float]:
        """Collect performance metrics."""
        try:
            # Simple throughput estimation based on system load
            cpu_percent = psutil.cpu_percent(interval=0.1)
            estimated_qps = max(0, 20 - (cpu_percent / 5))  # Simple heuristic
            
            return {
                'throughput_qps': estimated_qps,
                'cpu_usage_percent': cpu_percent
            }
            
        except Exception as e:
            logger.debug(f"Could not collect performance metrics: {e}")
            return {
                'throughput_qps': 0.0,
                'cpu_usage_percent': 0.0
            }
    
    def _get_system_load_avg(self) -> float:
        """Get system load average in a cross-platform way."""
        try:
            # Try Unix systems first (Linux, macOS)
            getloadavg_func = getattr(os, 'getloadavg', None)
            if getloadavg_func is not None:
                load_avg = getloadavg_func()
                return float(load_avg[0])  # Return 1-minute load average
            else:
                # On Windows, use CPU percent as a proxy for load
                # Get average across all CPUs
                cpu_percent = psutil.cpu_percent(interval=0.1)
                return float(cpu_percent)
        except Exception as e:
            logger.debug(f"Could not get system load average: {e}")
            return 0.0

    def _collect_system_metrics(self) -> Dict[str, Any]:
        """Collect general system health metrics."""
        try:
            # System-wide metrics
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            return {
                'system_memory_percent': memory.percent,
                'system_disk_percent': disk.percent,
                'system_load_avg': self._get_system_load_avg(),
                'uptime_seconds': time.time() - psutil.boot_time()
            }
            
        except Exception as e:
            logger.debug(f"Could not collect system metrics: {e}")
            return {
                'system_memory_percent': 0.0,
                'system_disk_percent': 0.0,
                'system_load_avg': 0.0,
                'uptime_seconds': 0.0
            }
    
    def _get_default_metrics(self) -> Dict[str, Any]:
        """Return default metrics when no data is available."""
        return {
            'timestamp': time.time(),
            'collection_time': datetime.now().isoformat(),
            'accuracy_metrics': {
                'overlap_at_10': 0.0,
                'recall_at_5': 0.0,
                'mean_reciprocal_rank': 0.0,
                'query_latency_ms': 0.0
            },
            'resource_metrics': {
                'memory_usage_mb': 0.0,
                'index_size_mb': 0.0,
                'build_time_seconds': 0.0
            },
            'performance_metrics': {
                'throughput_qps': 0.0,
                'cpu_usage_percent': 0.0
            },
            'system_metrics': {
                'system_memory_percent': 0.0,
                'system_disk_percent': 0.0,
                'system_load_avg': 0.0,
                'uptime_seconds': 0.0
            },
            'status': 'no_data',
            'message': 'No metrics collected yet'
        }
    
    def _load_historical_data(self):
        """Load historical data from disk."""
        try:
            history_file = os.path.join(self.storage_path, 'historical_data.json')
            if os.path.exists(history_file):
                with open(history_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                # Filter out old data
                cutoff_time = time.time() - self.history_retention
                recent_data = [
                    item for item in data 
                    if item.get('timestamp', 0) > cutoff_time
                ]
                
                self.historical_data.extend(recent_data)
                logger.info(f"Loaded {len(recent_data)} historical data points")
                
        except Exception as e:
            logger.debug(f"Could not load historical data: {e}")
    
    def _save_historical_data(self):
        """Save historical data to disk."""
        try:
            history_file = os.path.join(self.storage_path, 'historical_data.json')
            
            # Convert deque to list for JSON serialization
            data_to_save = list(self.historical_data)
            
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump(data_to_save, f, indent=2)
                
        except Exception as e:
            logger.debug(f"Could not save historical data: {e}")


# Global KPI collector instance
_kpi_collector: Optional[KPICollector] = None

def get_kpi_collector() -> KPICollector:
    """Get or create the global KPI collector instance."""
    global _kpi_collector
    if _kpi_collector is None:
        _kpi_collector = KPICollector()
    return _kpi_collector

def start_kpi_collection():
    """Start the global KPI collection process."""
    collector = get_kpi_collector()
    collector.start_collection()

def stop_kpi_collection():
    """Stop the global KPI collection process."""
    global _kpi_collector
    if _kpi_collector:
        _kpi_collector.stop_collection()

def get_current_kpis() -> Dict[str, Any]:
    """Get current KPI metrics."""
    collector = get_kpi_collector()
    return collector.get_current_metrics()

def get_kpi_history(hours: int = 24) -> List[Dict[str, Any]]:
    """Get historical KPI data."""
    collector = get_kpi_collector()
    return collector.get_historical_data(hours)

def force_kpi_collection() -> Dict[str, Any]:
    """Force immediate KPI collection."""
    collector = get_kpi_collector()
    return collector.force_collection()


if __name__ == "__main__":
    # Test the KPI collector
    collector = KPICollector(collection_interval=5)  # 5 second intervals for testing
    
    try:
        collector.start_collection()
        print("KPI collection started. Press Ctrl+C to stop.")
        
        while True:
            time.sleep(10)
            current = collector.get_current_metrics()
            print(f"Current metrics: {current.get('accuracy_metrics', {}).get('query_latency_ms', 'N/A')}ms latency")
            
    except KeyboardInterrupt:
        print("\nStopping KPI collection...")
        collector.stop_collection()