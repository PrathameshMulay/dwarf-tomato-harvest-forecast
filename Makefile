# Tomato Harvest POC. See CLAUDE.md and SPEC.md.
PY ?= .venv/bin/python
export HARVEST_INPUTS ?= $(abspath out)

.PHONY: setup test build app

setup:
	python3 -m venv .venv
	.venv/bin/pip install -q -r requirements-poc.txt

test:
	$(PY) -m pytest -q
	$(PY) contracts/check.py

build:
	$(PY) -m harvest.publish

app:
	$(PY) -m http.server 8766 --directory app
