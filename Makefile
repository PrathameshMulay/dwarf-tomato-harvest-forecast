# Tomato Harvest POC. See CLAUDE.md and SPEC.md.
PY ?= .venv/bin/python
export HARVEST_INPUTS ?= $(abspath out)

.PHONY: setup test build app

setup:
	python3 -m venv .venv
	.venv/bin/pip install -q -r requirements-poc.txt

test:
	"$(PY)" -m pytest -q
	"$(PY)" contracts/check.py
	"$(PY)" app/check_app.py

build:
	"$(PY)" scripts/select_photos.py
	"$(PY)" -m harvest.publish
	"$(PY)" contracts/check.py app/data
	"$(PY)" app/check_app.py app/data

app:
	"$(PY)" -m http.server 8766 --directory app
