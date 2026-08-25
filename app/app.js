const results = [
  { size: 10000, backrun: 407272, direct: 389292, ratioBps: 9558 },
  { size: 25000, backrun: 409381, direct: 413409, ratioBps: 10098 },
  { size: 50000, backrun: 544186, direct: 440127, ratioBps: 8087 },
  { size: 100000, backrun: 544187, direct: 440128, ratioBps: 8087 },
  { size: 200000, backrun: 544177, direct: 440117, ratioBps: 8087 },
];

const format = new Intl.NumberFormat("en-US");
const buttons = [...document.querySelectorAll("[data-size]")];
const backrunGas = document.querySelector("#backrun-gas");
const directGas = document.querySelector("#direct-gas");
const backrunBar = document.querySelector("#backrun-bar");
const directBar = document.querySelector("#direct-bar");
const saving = document.querySelector("#gas-saving");
const saved = document.querySelector("#gas-saved");
const selectedSize = document.querySelector("#selected-size");

function render(size) {
  const row = results.find((item) => item.size === size);
  const reduction = ((row.backrun - row.direct) / row.backrun) * 100;
  const maximum = Math.max(row.backrun, row.direct);
  backrunGas.textContent = format.format(row.backrun);
  directGas.textContent = format.format(row.direct);
  backrunBar.style.width = `${(row.backrun / maximum) * 100}%`;
  directBar.style.width = `${(row.direct / maximum) * 100}%`;
  saving.textContent = reduction >= 0 ? `${reduction.toFixed(2)}% less` : `${Math.abs(reduction).toFixed(2)}% more`;
  const gasDelta = row.backrun - row.direct;
  saved.textContent = gasDelta >= 0
    ? `${format.format(gasDelta)} gas avoided`
    : `${format.format(Math.abs(gasDelta))} additional gas`;
  selectedSize.textContent = `${format.format(size / 1000)}k`;
  buttons.forEach((button) => button.classList.toggle("active", Number(button.dataset.size) === size));
}

buttons.forEach((button) => button.addEventListener("click", () => render(Number(button.dataset.size))));
render(100000);

const zeroAddress = "0x0000000000000000000000000000000000000000";
const proofStatus = document.querySelector("#proof-status");

function abbreviated(value) {
  return value && value.startsWith("0x") ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function tokenAmount(value) {
  if (value === undefined || value === null) return "—";
  const amount = BigInt(value);
  const whole = amount / 10n ** 18n;
  const fraction = (amount % 10n ** 18n).toString().padStart(18, "0").slice(0, 6).replace(/0+$/, "");
  return fraction ? `${format.format(whole)}.${fraction}` : format.format(whole);
}

function setText(id, value) {
  document.querySelector(`#${id}`).textContent = value;
}

function setExplorerLink(id, base, kind, value) {
  const link = document.querySelector(`#${id}`);
  link.textContent = abbreviated(value);
  link.href = `${base}/${kind}/${value}`;
}

function reserveLine(reserves) {
  return [
    `AB  ${tokenAmount(reserves.abA)} A / ${tokenAmount(reserves.abB)} B`,
    `BC  ${tokenAmount(reserves.bcB)} B / ${tokenAmount(reserves.bcC)} C`,
    `AC  ${tokenAmount(reserves.acA)} A / ${tokenAmount(reserves.acC)} C`,
  ].join("\n");
}

async function loadOnchainProof() {
  try {
    const manifestPaths = [
      "./deployments/unichain-sepolia-1301.json",
      "../deployments/unichain-sepolia-1301.json",
    ];
    let response;
    for (const path of manifestPaths) {
      const candidate = await fetch(path, { cache: "no-store" });
      if (candidate.ok) {
        response = candidate;
        break;
      }
    }
    if (!response) throw new Error("manifest unavailable");
    const manifest = await response.json();
    if (manifest.researchOnly !== true || manifest.chainId !== 1301 || !manifest.demo) {
      throw new Error("manifest failed the research-deployment schema gate");
    }

    const explorer = manifest.explorerBaseUrl.replace(/\/$/, "");
    const official = manifest.officialPoolManager !== zeroAddress
      && manifest.officialPoolManager.toLowerCase() === manifest.poolManager.toLowerCase();
    proofStatus.classList.add("ready");
    proofStatus.textContent = "Verified public evidence";
    setText("proof-network", `${manifest.network} · chain ${manifest.chainId}`);
    setText("proof-manager-kind", official ? "Official Uniswap v4 PoolManager" : "Isolated research PoolManager");
    setText("proof-block", format.format(manifest.blockNumber));
    setText("proof-source", manifest.sourceVerification);
    setExplorerLink("proof-transaction", explorer, "tx", manifest.canonicalDemoTransaction);
    setExplorerLink("proof-manager", explorer, "address", manifest.poolManager);
    setExplorerLink("proof-coordinator", explorer, "address", manifest.coordinator);
    setExplorerLink("proof-router", explorer, "address", manifest.router);
    setExplorerLink("proof-hook-ab", explorer, "address", manifest.hooks.ab);
    setExplorerLink("proof-hook-bc", explorer, "address", manifest.hooks.bc);
    setExplorerLink("proof-hook-ac", explorer, "address", manifest.hooks.ac);

    setText("proof-swap", `${tokenAmount(manifest.demo.amountIn)} in → ${tokenAmount(manifest.demo.amountOut)} out`);
    setText("proof-rounds", `${manifest.demo.foldRounds} verified fold round${manifest.demo.foldRounds === 1 ? "" : "s"}`);
    setText("proof-reward", `${tokenAmount(manifest.demo.solverReward)} A`);
    setText("proof-residual", `${manifest.demo.residualProfit} wei A`);
    setText("proof-pre-reserves", reserveLine(manifest.demo.preReserves));
    setText("proof-post-reserves", reserveLine(manifest.demo.postReserves));

    const commitLink = document.querySelector("#proof-commit");
    commitLink.textContent = manifest.gitCommit.slice(0, 12);
    commitLink.href = `https://github.com/danelerr/arbfold-uhi10/commit/${manifest.gitCommit}`;
    setText(
      "proof-pending-detail",
      "Committed manifest loaded; transaction, contracts and canonical state are linked to public evidence.",
    );
  } catch (error) {
    proofStatus.classList.add("pending");
    proofStatus.textContent = "Public deployment pending";
    setText("proof-network", "Local end-to-end path verified in CI");
    setText("proof-manager-kind", "Unichain Sepolia manifest not published yet");
    document.querySelector("#proof-pending-detail").textContent =
      `The dashboard is fail-closed: it will not invent onchain evidence. ${error.message}.`;
  }
}

loadOnchainProof();
