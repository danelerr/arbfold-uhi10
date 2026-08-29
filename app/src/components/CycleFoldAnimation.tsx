import { TOKEN_SYMBOLS } from "../../swap-lab-core.js";
import type { TokenRole } from "../types";

interface CycleFoldAnimationProps {
  cycle: TokenRole[];
  folded?: boolean;
}

export function CycleFoldAnimation({ cycle, folded = false }: CycleFoldAnimationProps) {
  return (
    <div className={`cycle-visual ${folded ? "is-folded" : ""}`} aria-label={cycle.map((role) => TOKEN_SYMBOLS[role]).join(" to ")}>
      <div className="cycle-track" aria-hidden="true">
        {cycle.map((role, index) => (
          <span className="cycle-segment" key={`${role}-${index}`}>
            <b>{TOKEN_SYMBOLS[role]}</b>
            {index < cycle.length - 1 && <i>→</i>}
          </span>
        ))}
      </div>
      {folded && <span className="fold-outcome">Transition applied · remaining arbitrage 0</span>}
    </div>
  );
}
