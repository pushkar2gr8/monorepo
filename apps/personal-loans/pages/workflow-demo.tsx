import { useState } from 'react';
import { FormWorkflow } from '@nbfc/form-workflow';
import {
  initialLoanApplicationValues,
  loanApplicationWorkflow,
  LoanApplicationLayout,
  type LoanApplicationValues,
} from '../components/loan-application-workflow';

export default function WorkflowDemoPage() {
  const [submitted, setSubmitted] = useState<LoanApplicationValues | null>(null);
  const [log, setLog] = useState<string[]>([]);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h1>Personal loan application — workflow demo</h1>
      {submitted ? (
        <>
          <p>Application submitted.</p>
          <pre>{JSON.stringify(submitted, null, 2)}</pre>
          <button type="button" onClick={() => setSubmitted(null)}>
            Start again
          </button>
        </>
      ) : (
        <FormWorkflow<LoanApplicationValues>
          nodes={loanApplicationWorkflow}
          initialValues={initialLoanApplicationValues}
          onStepChange={(step) => setLog((entries) => [...entries, step.id])}
          onSubmit={async (values) => {
            await new Promise((resolve) => setTimeout(resolve, 500));
            setSubmitted(values);
          }}
        >
          <LoanApplicationLayout />
        </FormWorkflow>
      )}
      <details style={{ marginTop: 32 }}>
        <summary>Step change log</summary>
        <p>{log.join(' → ') || '—'}</p>
      </details>
    </main>
  );
}
