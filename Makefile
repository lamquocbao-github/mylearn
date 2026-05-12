BACKEND_DIR = backend
FRONTEND_DIR = frontend

# ── Local development ──────────────────────────────────────

.PHONY: install
install: install-backend install-frontend

install-backend:
	cd $(BACKEND_DIR) && python3 -m venv venv && venv/bin/pip install -r requirements.txt

install-frontend:
	cd $(FRONTEND_DIR) && npm install

.PHONY: backend
backend:
	cd $(BACKEND_DIR) && venv/bin/uvicorn main:app --reload

.PHONY: frontend
frontend:
	cd $(FRONTEND_DIR) && npm run dev

.PHONY: dev
dev:
	@echo "Starting backend and frontend..."
	@cd $(BACKEND_DIR) && venv/bin/uvicorn main:app --reload & \
	 cd $(FRONTEND_DIR) && npm run dev

# ── Utilities ──────────────────────────────────────────────

.PHONY: clean
clean:
	rm -rf $(BACKEND_DIR)/venv $(BACKEND_DIR)/__pycache__ $(BACKEND_DIR)/mylearn.db
	rm -rf $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/dist
