.PHONY: test test-core test-benchmark test-research test-deployment test-release-fuzz arithmetic coverage slither source-manifest source-manifest-check fmt lint snapshot verify-release video-proof serve

test: test-core test-benchmark test-research

test-core:
	cd contracts && forge test --offline

test-benchmark:
	cd benchmark/arbfold-foundry && forge test --offline -q

test-research:
	python3 -m unittest discover -s tests -p 'test_arbfold*.py' -v

test-deployment:
	bash scripts/smoke-deployment.sh

test-release-fuzz:
	cd contracts && FOUNDRY_PROFILE=release forge test --offline --match-contract 'ArbFold(Test|InvariantTest)|CycleMathTest' --fuzz-seed 0x1057

arithmetic:
	python3 -m arbfold_sim.arithmetic_differential --samples 50000 --seed 1057 --check --expected benchmark/arithmetic-differential-v1.json
	cd contracts && FOUNDRY_PROFILE=arithmetic forge test --offline --match-contract CycleMathTest --fuzz-seed 0x1057

coverage:
	cd contracts && forge coverage --report lcov --no-match-coverage '(script|test|lib)' --no-match-contract ArbFoldDeploymentTest
	python3 scripts/check-lcov.py contracts/lcov.info

slither:
	bash scripts/run-slither.sh

source-manifest:
	python3 scripts/source-manifest.py --write benchmark/release-candidate-results/source-manifest.sha256

source-manifest-check:
	python3 scripts/source-manifest.py --check benchmark/release-candidate-results/source-manifest.sha256

fmt:
	cd contracts && forge fmt --check
	# The frozen benchmark is intentionally immutable; formatting applies only to the clean core.

lint:
	cd contracts && forge lint --severity high

snapshot:
	cd contracts && forge snapshot --offline

verify-release: fmt
	cd contracts && forge clean && forge build --offline
	$(MAKE) test-core
	$(MAKE) test-release-fuzz
	$(MAKE) arithmetic
	$(MAKE) test-benchmark
	$(MAKE) test-research
	$(MAKE) test-deployment
	$(MAKE) lint
	$(MAKE) slither
	$(MAKE) coverage
	$(MAKE) source-manifest-check

video-proof:
	bash scripts/video-proof.sh

serve:
	python3 -m http.server 8080
