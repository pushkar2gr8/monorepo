import { useState } from 'react';
import { LoanCalculator } from '@nbfc/loan-calculator';

export type CustomerType = 'NTB' | 'ETB';
type FormStep = 1 | 2 | 3 | 4;

export const personalLoanSteps: Record<CustomerType, readonly FormStep[]> = {
  NTB: [1, 3, 4],
  ETB: [1, 2, 3, 4],
};

export default function PersonalLoansPageV2() {
  const [customerType, setCustomerType] = useState<CustomerType>('NTB');
  const [stepIndex, setStepIndex] = useState(0);
  const steps = personalLoanSteps[customerType];
  const currentStep = steps[stepIndex];

  return (
    <main>
      <h1>Personal Loans</h1>
      <p>Personal loan application and eligibility calculator.</p>
      <fieldset>
        <legend>Customer type</legend>
        {(['NTB', 'ETB'] as const).map((type) => (
          <label key={type}>
            <input
              type="radio"
              name="customerType"
              value={type}
              checked={customerType === type}
              onChange={() => {
                setCustomerType(type);
                setStepIndex(0);
              }}
            />
            {type === 'NTB' ? 'New customer (NTB)' : 'Existing customer (ETB)'}
          </label>
        ))}
      </fieldset>

      <nav aria-label="Application progress">
        <ol>
          {steps.map((step) => (
            <li key={step} aria-current={step === currentStep ? 'step' : undefined}>
              Form {step}
            </li>
          ))}
        </ol>
      </nav>

      <section aria-labelledby="current-form-title" aria-live="polite">
        <h2 id="current-form-title" tabIndex={-1}>
          Form {currentStep}
        </h2>
        <p>Step {stepIndex + 1} of {steps.length}</p>
        {currentStep === 3 && <LoanCalculator />}
      </section>

      <fieldset>
        <legend>Form navigation</legend>
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
        >
          Back
        </button>
        <button
          type="button"
          disabled={stepIndex === steps.length - 1}
          onClick={() => setStepIndex((index) => Math.min(steps.length - 1, index + 1))}
        >
          Continue
        </button>
      </fieldset>
    </main>
  );
}
