.PHONY: test test-core test-benchmark test-research fmt lint snapshot serve

test: test-core test-benchmark test-research

test-core:
	cd contracts && forge test --offline

test-benchmark:
	cd benchmark/arbfold-foundry && forge test --offline -q

test-research:
	python3 -m unittest discover -s tests -p 'test_arbfold*.py' -v

fmt:
	cd contracts && forge fmt --check
	# The frozen benchmark is intentionally immutable; formatting applies only to the clean core.

lint:
	cd contracts && forge lint --severity high

snapshot:
	cd contracts && forge snapshot --offline

serve:
	python3 -m http.server 8080
