"""Deterministic arbitrary-precision differential analysis for ``CycleMath``.

The "delivered" path mirrors the bounded integer normalization used in
``contracts/src/CycleMath.sol``.  The reference path composes the same three
fractional-linear CPMM legs with Python arbitrary-precision integers and never
normalizes its coefficients.  Both paths retain EVM-style floor rounding for
swaps, rewards and reserve transitions.
"""

from __future__ import annotations

import argparse
import json
import random
from dataclasses import asdict, dataclass
from math import isqrt
from typing import Iterable, Sequence

DENOMINATOR = 1_000_000
GAMMA = 997_000
NORMALIZED_MAX = 10**36
MIN_NETWORK_RESERVE = 10**18
MAX_NETWORK_RESERVE = 3_000_000 * 10**18
RESIDUAL_THRESHOLD = 10**12
SOLVER_SHARE_BPS = 1_000
BPS = 10_000
MAX_ROUNDS = 8

Network = tuple[int, int, int, int, int, int]
Leg = tuple[int, int]


@dataclass(frozen=True)
class Quote:
    reverse: bool
    amount_a_in: int
    intermediate_first: int
    intermediate_second: int
    amount_a_out: int
    profit_a: int


@dataclass
class ErrorMetric:
    max_absolute: int = 0
    max_relative: float = 0.0

    def observe(self, actual: int, expected: int) -> None:
        absolute = abs(actual - expected)
        relative = absolute / max(abs(expected), 1)
        self.max_absolute = max(self.max_absolute, absolute)
        self.max_relative = max(self.max_relative, relative)


def _normalize(a: int, b: int, c: int) -> tuple[int, int, int]:
    maximum = max(a, b, c)
    if maximum <= NORMALIZED_MAX:
        return a, b, c
    scale = (maximum + NORMALIZED_MAX - 1) // NORMALIZED_MAX
    return a // scale, b // scale, c // scale


def swap_out(amount_in: int, reserve_in: int, reserve_out: int) -> int:
    if amount_in == 0:
        return 0
    return amount_in * GAMMA * reserve_out // (reserve_in * DENOMINATOR + amount_in * GAMMA)


def _optimal_input(legs: Sequence[Leg], *, normalize: bool) -> int:
    a = GAMMA * legs[0][1]
    b = DENOMINATOR * legs[0][0]
    c = GAMMA
    for reserve_in, reserve_out in legs[1:]:
        next_a = GAMMA * reserve_out
        next_b = DENOMINATOR * reserve_in
        a, b, c = next_a * a, next_b * b, next_b * c + GAMMA * a
        if normalize:
            a, b, c = _normalize(a, b, c)
    if normalize:
        a, b, c = _normalize(a, b, c)
    root = isqrt(a * b)
    return 0 if root <= b or c == 0 else (root - b) // c


def _legs(network: Network, reverse: bool) -> tuple[Leg, Leg, Leg]:
    ab_a, ab_b, bc_b, bc_c, ac_a, ac_c = network
    if not reverse:
        return (ab_a, ab_b), (bc_b, bc_c), (ac_c, ac_a)
    return (ac_a, ac_c), (bc_c, bc_b), (ab_b, ab_a)


def quote(network: Network, reverse: bool, *, normalize: bool) -> Quote:
    legs = _legs(network, reverse)
    amount_a_in = _optimal_input(legs, normalize=normalize)
    first = swap_out(amount_a_in, *legs[0])
    second = swap_out(first, *legs[1])
    amount_a_out = swap_out(second, *legs[2])
    return Quote(
        reverse,
        amount_a_in,
        first,
        second,
        amount_a_out,
        max(amount_a_out - amount_a_in, 0),
    )


def best(network: Network, *, normalize: bool) -> Quote:
    forward = quote(network, False, normalize=normalize)
    reverse = quote(network, True, normalize=normalize)
    return forward if forward.profit_a >= reverse.profit_a else reverse


def apply(network: Network, selected: Quote) -> tuple[Network, int] | None:
    reward = selected.profit_a * SOLVER_SHARE_BPS // BPS
    q = selected.amount_a_in
    first = selected.intermediate_first
    second = selected.intermediate_second
    ab_a, ab_b, bc_b, bc_c, ac_a, ac_c = network
    if not selected.reverse:
        after = (ab_a + q, ab_b - first, bc_b + first, bc_c - second, ac_a - q - reward, ac_c + second)
    else:
        after = (ab_a - q - reward, ab_b + second, bc_b - second, bc_c + first, ac_a + q, ac_c - first)
    if any(value < MIN_NETWORK_RESERVE or value > MAX_NETWORK_RESERVE for value in after):
        return None
    return after, reward


def fold(network: Network, *, normalize: bool) -> tuple[Network, int, int] | None:
    current = network
    total_reward = 0
    rounds = 0
    for _ in range(MAX_ROUNDS):
        selected = best(current, normalize=normalize)
        if selected.profit_a <= RESIDUAL_THRESHOLD:
            break
        transition = apply(current, selected)
        if transition is None:
            return None
        current, reward = transition
        total_reward += reward
        rounds += 1
    return current, total_reward, best(current, normalize=normalize).profit_a


def _sample_value(rng: random.Random) -> int:
    exponent = rng.randrange(18, 25)
    lower = 10**exponent
    upper = min(MAX_NETWORK_RESERVE, 10 ** (exponent + 1) - 1)
    return rng.randrange(lower, upper + 1)


def networks(samples: int, seed: int) -> Iterable[Network]:
    boundaries: tuple[Network, ...] = (
        (MIN_NETWORK_RESERVE,) * 6,
        (MAX_NETWORK_RESERVE,) * 6,
        (
            333_333333333333333333,
            1_200_000 * 10**18,
            1_000_000 * 10**18,
            1_000_000 * 10**18,
            333_333333333333333333,
            1_000_000 * 10**18,
        ),
        (
            1_000_000 * 10**18,
            500_000 * 10**18,
            2_000_000 * 10**18,
            750_000 * 10**18,
            900_000 * 10**18,
            2_500_000 * 10**18,
        ),
    )
    for item in boundaries[:samples]:
        yield item
    rng = random.Random(seed)
    for _ in range(max(0, samples - len(boundaries))):
        yield tuple(_sample_value(rng) for _ in range(6))  # type: ignore[return-value]


def analyze(samples: int, seed: int) -> dict[str, object]:
    quote_metrics = {
        name: ErrorMetric()
        for name in (
            "amount_a_in",
            "intermediate_first",
            "intermediate_second",
            "amount_a_out",
            "profit_a",
        )
    }
    final_reserve = ErrorMetric()
    solver_reward = ErrorMetric()
    residual_profit = ErrorMetric()
    direction_mismatches = 0
    valid_fold_pairs = 0
    rejected_fold_domain = 0

    for network in networks(samples, seed):
        delivered = best(network, normalize=True)
        reference = best(network, normalize=False)
        direction_mismatches += delivered.reverse != reference.reverse
        for name, metric in quote_metrics.items():
            metric.observe(getattr(delivered, name), getattr(reference, name))

        delivered_fold = fold(network, normalize=True)
        reference_fold = fold(network, normalize=False)
        if delivered_fold is None or reference_fold is None:
            rejected_fold_domain += 1
            continue
        valid_fold_pairs += 1
        delivered_network, delivered_reward, delivered_residual = delivered_fold
        reference_network, reference_reward, reference_residual = reference_fold
        for actual, expected in zip(delivered_network, reference_network):
            final_reserve.observe(actual, expected)
        solver_reward.observe(delivered_reward, reference_reward)
        residual_profit.observe(delivered_residual, reference_residual)

    result = {
        "schema": "arbfold-arithmetic-differential-v1",
        "seed": seed,
        "samples": samples,
        "domain": {
            "reserve_min": MIN_NETWORK_RESERVE,
            "reserve_max": MAX_NETWORK_RESERVE,
            "fee_denominator": DENOMINATOR,
            "fee_gamma": GAMMA,
            "normalization_ceiling": NORMALIZED_MAX,
            "max_rounds": MAX_ROUNDS,
            "residual_threshold": RESIDUAL_THRESHOLD,
        },
        "direction_mismatches": direction_mismatches,
        "valid_fold_pairs": valid_fold_pairs,
        "rejected_fold_domain": rejected_fold_domain,
        "quote_error": {name: asdict(metric) for name, metric in quote_metrics.items()},
        "final_reserve_error": asdict(final_reserve),
        "solver_reward_error": asdict(solver_reward),
        "residual_profit_error": asdict(residual_profit),
    }
    return result


def passes(result: dict[str, object]) -> bool:
    quote_error = result["quote_error"]
    assert isinstance(quote_error, dict)
    return (
        result["direction_mismatches"] == 0
        and quote_error["amount_a_in"]["max_relative"] <= 1e-9
        and quote_error["profit_a"]["max_relative"] <= 1e-8
        and result["final_reserve_error"]["max_relative"] <= 1e-8
        and result["solver_reward_error"]["max_relative"] <= 1e-8
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=50_000)
    parser.add_argument("--seed", type=int, default=1057)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--expected", type=str)
    args = parser.parse_args()
    result = analyze(args.samples, args.seed)
    print(json.dumps(result, indent=2, sort_keys=True))
    if args.expected:
        with open(args.expected, encoding="utf-8") as expected_file:
            expected = json.load(expected_file)
        if result != expected:
            return 1
    return int(args.check and not passes(result))


if __name__ == "__main__":
    raise SystemExit(main())
