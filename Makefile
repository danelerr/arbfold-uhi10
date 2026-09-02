.PHONY: test test-core test-benchmark test-research test-dashboard test-deployment test-release-fuzz arithmetic coverage slither benchmark-v01 source-manifest source-manifest-check source-manifest-v0-check fmt lint snapshot verify-release video-proof build-dashboard check-sources check-live submission-preflight serve

test: test-core test-benchmark test-research test-dashboard

test-core:
	cd contracts && forge test --offline

test-benchmark:
	cd benchmark/arbfold-foundry && forge test --offline -q

test-research:
	python3 -m unittest discover -s tests -p 'test_arbfold*.py' -v

test-dashboard:
	npm run test:dashboard

build-dashboard:
	npm run build:dashboard

check-live:
	npm run check:live

check-sources:
	npm run check:sources

submission-preflight:
	npm run preflight:submission
	npm run check:sources
	npm run check:live

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

benchmark-v01:
	python3 scripts/generate-v01-benchmark.py --check

source-manifest: benchmark-v01

source-manifest-check:
	python3 scripts/source-manifest.py --scope optimized-v01 --check benchmark/optimized-release-candidate-results/source-manifest.sha256

source-manifest-v0-check:
	python3 research/reassess_arbfold.py --check research/results/arbfold-thesis-reassessment-2026-08-29.json

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
	$(MAKE) benchmark-v01
	$(MAKE) arithmetic
	$(MAKE) test-benchmark
	$(MAKE) test-research
	$(MAKE) test-dashboard
	$(MAKE) build-dashboard
	$(MAKE) test-deployment
	$(MAKE) lint
	$(MAKE) slither
	$(MAKE) coverage
	$(MAKE) source-manifest-check
	$(MAKE) check-sources
	python3 research/reassess_arbfold_v01.py --check research/results/arbfold-v0.1-reassessment-2026-08-30.json

video-proof:
	bash scripts/video-proof.sh

serve:
	npm run build:dashboard
	python3 -m http.server 8080 --directory dist
