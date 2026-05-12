const state = {
  invoices: 1,
  collected: 0,
  outstanding: 85000,
  selectedPayment: 85000,
  records: [
    { name: "Initial preview invoice", amount: 85000, status: "Awaiting payment" }
  ]
};

const money = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
});

const els = {
  collected: document.querySelector("#collected"),
  outstanding: document.querySelector("#outstanding"),
  invoiceCount: document.querySelector("#invoiceCount"),
  invoiceTotal: document.querySelector("#invoiceTotal"),
  invoiceMeta: document.querySelector("#invoiceMeta"),
  amountDue: document.querySelector("#amountDue"),
  recordsList: document.querySelector("#recordsList"),
  studentName: document.querySelector("#studentName"),
  studentClass: document.querySelector("#studentClass"),
  feeItem: document.querySelector("#feeItem")
};

function render() {
  const amount = Number(els.feeItem.value);
  els.collected.textContent = money.format(state.collected);
  els.outstanding.textContent = money.format(state.outstanding);
  els.invoiceCount.textContent = String(state.invoices);
  els.invoiceTotal.textContent = money.format(amount);
  els.amountDue.textContent = money.format(Math.max(state.outstanding, amount));
  els.invoiceMeta.textContent = `${els.studentName.value} • ${els.studentClass.value} • Awaiting payment`;
  els.recordsList.innerHTML = state.records.map(record => `
    <div class="record">
      <div>
        <strong>${record.name}</strong>
        <span>${record.status}</span>
      </div>
      <strong>${money.format(record.amount)}</strong>
    </div>
  `).join("");
}

document.querySelector("#issueInvoice").addEventListener("click", () => {
  const amount = Number(els.feeItem.value);
  state.invoices += 1;
  state.outstanding += amount;
  state.records.unshift({ name: `${els.studentName.value} invoice`, amount, status: "Issued" });
  render();
});

document.querySelectorAll("[data-pay]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-pay]").forEach(node => node.classList.remove("active"));
    button.classList.add("active");
    state.selectedPayment = Number(button.dataset.pay);
  });
});

document.querySelector("#recordPayment").addEventListener("click", () => {
  const paid = Math.min(state.selectedPayment, state.outstanding);
  state.collected += paid;
  state.outstanding -= paid;
  state.records.unshift({ name: `${els.studentName.value} payment`, amount: paid, status: "Recorded by POS" });
  render();
});

[els.studentName, els.studentClass, els.feeItem].forEach(node => node.addEventListener("input", render));
document.querySelector("[data-pay='85000']").classList.add("active");
render();
