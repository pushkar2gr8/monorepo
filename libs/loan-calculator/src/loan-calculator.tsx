import { useState } from 'react';

export default function LoanCalculator() {
  const [principal, setPrincipal] = useState(5000000);
  const [annualRate, setAnnualRate] = useState(8.5);
  const [termYears, setTermYears] = useState(20);

  const monthlyRate = annualRate / 1200;
  const months = termYears * 12;
  const monthlyPayment = monthlyRate === 0
    ? principal / months
    : principal * monthlyRate * (1 + monthlyRate) ** months / ((1 + monthlyRate) ** months - 1);

  return (
    <section aria-labelledby="loan-calculator-title">
      <h2 id="loan-calculator-title">Loan calculator</h2>
      <p>Shared NBFC loan calculator.</p>
      <p>version 2.0.0</p>
      <div>
        <label htmlFor="loan-principal">Loan amount (INR)</label>
        <input
          id="loan-principal"
          type="number"
          min="1"
          value={principal}
          onChange={(event) => setPrincipal(Number(event.target.value))}
        />
      </div>
      <div>
        <label htmlFor="loan-rate">Annual interest rate (%)</label>
        <input
          id="loan-rate"
          type="number"
          min="0"
          step="0.1"
          value={annualRate}
          onChange={(event) => setAnnualRate(Number(event.target.value))}
        />
      </div>
      <div>
        <label htmlFor="loan-term">Term (years)</label>
        <input
          id="loan-term"
          type="number"
          min="1"
          value={termYears}
          onChange={(event) => setTermYears(Number(event.target.value))}
        />
      </div>
      <p aria-live="polite">
        Estimated monthly payment: ₹{Math.round(monthlyPayment).toLocaleString('en-IN')}
      </p>
    </section>
  );
}
