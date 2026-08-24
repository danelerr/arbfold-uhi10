import math
import random
import unittest

from arbfold_sim.mechanism import (
    Pool,
    Triangle,
    best_cycle,
    defensive_rebalance,
    fold_until_no_arbitrage,
    quote_cycle,
    swap_out,
)


class ArbFoldTests(unittest.TestCase):
    def test_closed_form_cycle_matches_sequential_outputs(self):
        triangle = Triangle(Pool(17.0, 31.0), Pool(29.0, 13.0), Pool(19.0, 23.0))
        for reverse in (False, True):
            quote = quote_cycle(triangle, 0.997, reverse)
            self.assertGreaterEqual(quote.amount_a_in, 0.0)
            self.assertGreaterEqual(quote.amount_a_out, 0.0)
            if quote.amount_a_in == 0.0:
                continue
            if not reverse:
                legs = ((17.0, 31.0), (29.0, 13.0), (19.0, 23.0))
            else:
                legs = ((23.0, 19.0), (13.0, 29.0), (31.0, 17.0))

            def profit(amount):
                value = amount
                for reserve_in, reserve_out in legs:
                    value = swap_out(value, reserve_in, reserve_out, 0.997)
                return value - amount

            optimum = profit(quote.amount_a_in)
            self.assertGreaterEqual(optimum + 1e-12, profit(quote.amount_a_in * 0.99))
            self.assertGreaterEqual(optimum + 1e-12, profit(quote.amount_a_in * 1.01))

    def test_paper_triangle_becomes_fee_band_arbitrage_free(self):
        triangle = Triangle(Pool(1.0, 3.0), Pool(1.0, 3.0), Pool(1.0, 3.0))
        after, rounds = fold_until_no_arbitrage(triangle, 0.997, 0.10)
        self.assertGreaterEqual(len(rounds), 1)
        self.assertLessEqual(best_cycle(after, 0.997).profit_a, 1e-10)

    def test_random_rebalances_are_pareto_safe_and_conservative(self):
        rng = random.Random(730_2026)
        for _ in range(10_000):
            triangle = Triangle(
                Pool(10 ** rng.uniform(-1, 2), 10 ** rng.uniform(-1, 2)),
                Pool(10 ** rng.uniform(-1, 2), 10 ** rng.uniform(-1, 2)),
                Pool(10 ** rng.uniform(-1, 2), 10 ** rng.uniform(-1, 2)),
            )
            result = defensive_rebalance(triangle, 0.997, 0.10)
            before_k = triangle.invariants
            after_k = result.after.invariants
            for before, after in zip(before_k, after_k):
                self.assertGreaterEqual(after + 1e-9, before)

            before_a, before_b, before_c = triangle.token_totals
            after_a, after_b, after_c = result.after.token_totals
            self.assertAlmostEqual(before_a - after_a, result.solver_reward_a, places=7)
            self.assertAlmostEqual(before_b, after_b, places=7)
            self.assertAlmostEqual(before_c, after_c, places=7)
            self.assertGreaterEqual(result.retained_a, -1e-12)

    def test_solver_never_receives_more_than_threatened_profit(self):
        triangle = Triangle(Pool(1.0, 3.0), Pool(1.0, 3.0), Pool(1.0, 3.0))
        result = defensive_rebalance(triangle, 0.997, 0.10)
        self.assertGreater(result.quote.profit_a, 0.0)
        self.assertLessEqual(result.solver_reward_a, result.quote.profit_a)
        self.assertAlmostEqual(
            result.retained_a + result.solver_reward_a,
            result.quote.profit_a,
            places=12,
        )


if __name__ == "__main__":
    unittest.main()
