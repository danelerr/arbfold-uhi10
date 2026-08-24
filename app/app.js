const results = [
  { size: 10000, backrun: 403614, direct: 386610, ratioBps: 9578 },
  { size: 25000, backrun: 405309, direct: 409899, ratioBps: 10113 },
  { size: 50000, backrun: 537895, direct: 436429, ratioBps: 8113 },
  { size: 100000, backrun: 537896, direct: 436430, ratioBps: 8113 },
  { size: 200000, backrun: 537886, direct: 436419, ratioBps: 8113 },
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
