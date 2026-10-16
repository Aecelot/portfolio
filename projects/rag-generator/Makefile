.PHONY: help setup ingest embed index retrieve test clean build faiss-kpis faiss-monitor faiss-sweep eval-offline eval-api

help: ## Show this help message
	@echo 'Available commands:'
	@echo '  setup        - Set up development environment'
	@echo '  ingest       - Run ingestion pipeline (markdown → JSONL)'
	@echo '  embed        - Generate embeddings from JSONL'
	@echo '  index        - Build FAISS index from embeddings'
	@echo '  retrieve     - Start the retrieval API server'
	@echo '  test         - Run all tests'
	@echo '  clean        - Remove generated artifacts'
	@echo '  build        - Full pipeline: ingest → embed → index'
	@echo '  faiss-kpis   - Run comprehensive FAISS KPI evaluation'
	@echo '  faiss-monitor- Monitor FAISS index performance (for cron jobs)'
	@echo '  faiss-sweep  - Run parameter sweeps for FAISS optimization'
	@echo '  eval-offline - Evaluate retrieval (offline, in-process) and write reports'
	@echo '  eval-api     - Evaluate retrieval via live API and write reports'

setup: ## Set up development environment
	pip install -r requirements.txt
	python scripts/setup.py

ingest: ## Run ingestion pipeline (markdown → JSONL)
	python -m ingestion.build_jsonl

embed: ## Generate embeddings from JSONL
	python -m index.build_embeddings

index: ## Build FAISS index from embeddings
	python -m index.build_faiss

retrieve: ## Start the retrieval API server
 	uvicorn api.retriever:app --host 0.0.0.0 --port 8000 --reload

dev_api: ## Start API server in development mode
 	python -m api.retriever

test: ## Run all tests
	pytest tests/ -v

clean: ## Remove generated artifacts
	python -c "import shutil; shutil.rmtree('store', ignore_errors=True); print('✅ Store cleaned')"

build: ingest embed index ## Full pipeline: ingest → embed → index

faiss-kpis: ## Run comprehensive FAISS KPI evaluation
	@echo "🔍 Running FAISS KPI evaluation..."
	python -m index.faiss_evaluator

faiss-monitor: ## Monitor FAISS index performance (for cron jobs)
	@echo "📊 Monitoring FAISS KPIs..."
	python scripts/monitor_faiss_kpis.py

faiss-sweep: ## Run parameter sweeps for FAISS optimization
	@echo "🔄 Running FAISS parameter sweeps..."
	python -c "
	from index.faiss_evaluator import FAISSEvaluator
	import numpy as np

	# Load vectors
	vectors = np.load('store/vectors.npy')
	evaluator = FAISSEvaluator()

	# Run HNSW sweep
	print('Testing HNSW configurations...')
	hnsw_results = evaluator.parameter_sweep_hnsw(vectors)

	# Run IVF sweep
	print('Testing IVF configurations...')
	ivf_results = evaluator.parameter_sweep_ivf(vectors)

	print('✅ Parameter sweeps complete!')
	"

# Development pipeline
dev: build retrieve ## Full development cycle

eval-offline: ## Evaluate golden queries offline (in-process)
	@echo "🧪 Evaluating golden queries (offline)..."
	python tools/evaluate_golden_retrieval.py --mode offline --k 5 --output-dir storage/evaluation/offline

eval-api: ## Evaluate golden queries via live API
	@echo "🧪 Evaluating golden queries (API)..."
	python tools/evaluate_golden_retrieval.py --mode api --k 5 --base-url http://localhost:8000 --output-dir storage/evaluation/api