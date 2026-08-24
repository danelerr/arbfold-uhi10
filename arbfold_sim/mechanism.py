from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Tuple


@dataclass(frozen=True)
class Pool:
    reserve0: float
    reserve1: float

    def __post_init__(self) -> None:
        if self.reserve0 <= 0 or self.reserve1 <= 0:
            raise ValueError("pool reserves must be positive")

    @property
    def invariant(self) -> float:
        return self.reserve0 * self.reserve1


@dataclass(frozen=True)
class Triangle:
    """Three CPMMs ordered as A/B, B/C, C/A."""

    ab: Pool
    bc: Pool
    ca: Pool

    @property
    def token_totals(self) -> Tuple[float, float, float]:
        return (
            self.ab.reserve0 + self.ca.reserve1,
            self.ab.reserve1 + self.bc.reserve0,
            self.bc.reserve1 + self.ca.reserve0,
        )

    @property
    def invariants(self) -> Tuple[float, float, float]:
        return self.ab.invariant, self.bc.invariant, self.ca.invariant


@dataclass(frozen=True)
class CycleQuote:
    reverse: bool
    amount_a_in: float
    intermediate_first: float
    intermediate_second: float
    amount_a_out: float

    @property
    def profit_a(self) -> float:
        return self.amount_a_out - self.amount_a_in


@dataclass(frozen=True)
class RebalanceResult:
    before: Triangle
    after: Triangle
    quote: CycleQuote
    solver_reward_a: float

    @property
    def retained_a(self) -> float:
        return max(0.0, self.quote.profit_a - self.solver_reward_a)


def swap_out(amount_in: float, reserve_in: float, reserve_out: float, gamma: float) -> float:
    if amount_in < 0 or reserve_in <= 0 or reserve_out <= 0:
        raise ValueError("invalid swap domain")
    if not 0 < gamma <= 1:
        raise ValueError("gamma must be in (0, 1]")
    return reserve_out * gamma * amount_in / (reserve_in + gamma * amount_in)


def _compose_cycle_parameters(
    legs: Tuple[Tuple[float, float], Tuple[float, float], Tuple[float, float]],
    gamma: float,
) -> Tuple[float, float, float]:
    # Each leg is f(x) = a*x / (b + c*x), with a=gamma*rout,
    # b=rin, c=gamma. Composition remains fractional-linear.
    a, b, c = gamma * legs[0][1], legs[0][0], gamma
    for reserve_in, reserve_out in legs[1:]:
        next_a, next_b, next_c = gamma * reserve_out, reserve_in, gamma
        a, b, c = next_a * a, next_b * b, next_b * c + next_c * a
    return a, b, c


def _optimal_input(
    legs: Tuple[Tuple[float, float], Tuple[float, float], Tuple[float, float]],
    gamma: float,
) -> float:
    a, b, c = _compose_cycle_parameters(legs, gamma)
    # output(x)=a*x/(b+c*x); d(output)/dx=a*b/(b+c*x)^2.
    root = math.sqrt(a * b)
    if root <= b or c <= 0:
        return 0.0
    return (root - b) / c


def quote_cycle(triangle: Triangle, gamma: float, reverse: bool = False) -> CycleQuote:
    if not reverse:
        legs = (
            (triangle.ab.reserve0, triangle.ab.reserve1),
            (triangle.bc.reserve0, triangle.bc.reserve1),
            (triangle.ca.reserve0, triangle.ca.reserve1),
        )
        amount = _optimal_input(legs, gamma)
        token_b = swap_out(amount, *legs[0], gamma)
        token_c = swap_out(token_b, *legs[1], gamma)
        token_a = swap_out(token_c, *legs[2], gamma)
        return CycleQuote(False, amount, token_b, token_c, token_a)

    legs = (
        (triangle.ca.reserve1, triangle.ca.reserve0),
        (triangle.bc.reserve1, triangle.bc.reserve0),
        (triangle.ab.reserve1, triangle.ab.reserve0),
    )
    amount = _optimal_input(legs, gamma)
    token_c = swap_out(amount, *legs[0], gamma)
    token_b = swap_out(token_c, *legs[1], gamma)
    token_a = swap_out(token_b, *legs[2], gamma)
    return CycleQuote(True, amount, token_c, token_b, token_a)


def best_cycle(triangle: Triangle, gamma: float) -> CycleQuote:
    forward = quote_cycle(triangle, gamma, False)
    reverse = quote_cycle(triangle, gamma, True)
    return forward if forward.profit_a >= reverse.profit_a else reverse


def defensive_rebalance(
    triangle: Triangle,
    gamma: float,
    solver_share: float = 0.10,
    minimum_profit: float = 0.0,
) -> RebalanceResult:
    """Fold the best A-denominated cycle into pool reserves.

    The first two legs receive the same reserve changes as ordinary swaps. On
    the final leg, only principal plus the solver's share leaves the pool; the
    remainder of the threatened arbitrage profit stays in network liquidity.
    """
    if not 0 <= solver_share <= 1:
        raise ValueError("solver share must be within [0, 1]")
    quote = best_cycle(triangle, gamma)
    if quote.profit_a <= minimum_profit:
        return RebalanceResult(triangle, triangle, quote, 0.0)

    q = quote.amount_a_in
    reward = quote.profit_a * solver_share
    if not quote.reverse:
        token_b = quote.intermediate_first
        token_c = quote.intermediate_second
        after = Triangle(
            Pool(triangle.ab.reserve0 + q, triangle.ab.reserve1 - token_b),
            Pool(triangle.bc.reserve0 + token_b, triangle.bc.reserve1 - token_c),
            Pool(triangle.ca.reserve0 + token_c, triangle.ca.reserve1 - (q + reward)),
        )
    else:
        token_c = quote.intermediate_first
        token_b = quote.intermediate_second
        after = Triangle(
            Pool(triangle.ab.reserve0 - (q + reward), triangle.ab.reserve1 + token_b),
            Pool(triangle.bc.reserve0 - token_b, triangle.bc.reserve1 + token_c),
            Pool(triangle.ca.reserve0 - token_c, triangle.ca.reserve1 + q),
        )
    return RebalanceResult(triangle, after, quote, reward)


def fold_until_no_arbitrage(
    triangle: Triangle,
    gamma: float,
    solver_share: float = 0.10,
    minimum_profit: float = 1e-12,
    max_iterations: int = 8,
) -> Tuple[Triangle, Tuple[RebalanceResult, ...]]:
    current = triangle
    results = []
    for _ in range(max_iterations):
        result = defensive_rebalance(current, gamma, solver_share, minimum_profit)
        if result.after == current:
            break
        results.append(result)
        current = result.after
    return current, tuple(results)
