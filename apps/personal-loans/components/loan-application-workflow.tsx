import { ErrorMessage, Field } from 'formik';
import {
  andSplit,
  CurrentStep,
  orSplit,
  step,
  useFormWorkflow,
  type StepProps,
  type WorkflowNode,
} from '@nbfc/form-workflow';

export interface LoanApplicationValues {
  fullName: string;
  mobile: string;
  pan: string;
  employmentType: '' | 'salaried' | 'self-employed';
  employerName: string;
  monthlySalary: number | '';
  coApplicantName: string;
  coApplicantMobile: string;
  businessName: string;
  yearsInBusiness: number | '';
  itrYearsFiled: number | '';
  gstNumber: string;
  loanAmount: number | '';
  tenureMonths: number | '';
  addressProofType: string;
  bankName: string;
  consent: boolean;
}

export const initialLoanApplicationValues: LoanApplicationValues = {
  fullName: '',
  mobile: '',
  pan: '',
  employmentType: '',
  employerName: '',
  monthlySalary: '',
  coApplicantName: '',
  coApplicantMobile: '',
  businessName: '',
  yearsInBusiness: '',
  itrYearsFiled: '',
  gstNumber: '',
  loanAmount: '',
  tenureMonths: '',
  addressProofType: '',
  bankName: '',
  consent: false,
};

type V = LoanApplicationValues;
type Errors = Partial<Record<keyof V, string>>;

const HIGH_VALUE_LOAN = 500000;

interface SalaryVerification {
  requiresCoApplicant: boolean;
  decision: string;
  source: 'mock';
}

function isSalaryVerification(value: unknown): value is SalaryVerification {
  return typeof value === 'object' && value !== null &&
    'requiresCoApplicant' in value && typeof value.requiresCoApplicant === 'boolean' &&
    'decision' in value && typeof value.decision === 'string' &&
    'source' in value && value.source === 'mock';
}

function TextField({ name, label, type = 'text' }: Readonly<{ name: keyof V; label: string; type?: string }>) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={name} style={{ display: 'block', fontWeight: 600 }}>
        {label}
      </label>
      <Field id={name} name={name} type={type} style={{ padding: 6, width: '100%', maxWidth: 320 }} />
      <ErrorMessage name={name} render={(msg) => <div style={{ color: '#c0392b' }}>{msg}</div>} />
    </div>
  );
}

function required(values: V, fields: [keyof V, string][]): Errors {
  const errors: Errors = {};
  for (const [field, label] of fields) {
    if (values[field] === '' || values[field] === undefined) errors[field] = `${label} is required`;
  }
  return errors;
}

const ApplicantStep = () => (
  <>
    <TextField name="fullName" label="Full name" />
    <TextField name="mobile" label="Mobile number" />
    <TextField name="pan" label="PAN" />
  </>
);

const EmploymentStep = () => (
  <fieldset style={{ marginBottom: 12, border: 'none', padding: 0 }}>
    <legend style={{ fontWeight: 600 }}>Employment type</legend>
    <label>
      <Field type="radio" name="employmentType" value="salaried" /> Salaried
    </label>{' '}
    <label>
      <Field type="radio" name="employmentType" value="self-employed" /> Self-employed
    </label>
    <ErrorMessage name="employmentType" render={(msg) => <div style={{ color: '#c0392b' }}>{msg}</div>} />
  </fieldset>
);

const SalaryStep = () => (
  <>
    <TextField name="employerName" label="Employer name" />
    <TextField name="monthlySalary" label="Net monthly salary (INR)" type="number" />
  </>
);

const CoApplicantStep = () => (
  <>
    <p>Salary verification requires a co-applicant.</p>
    <TextField name="coApplicantName" label="Co-applicant name" />
    <TextField name="coApplicantMobile" label="Co-applicant mobile" />
  </>
);

const BusinessStep = () => (
  <>
    <TextField name="businessName" label="Business name" />
    <TextField name="yearsInBusiness" label="Years in business — under 3 asks for ITR, otherwise GST" type="number" />
  </>
);

const ItrStep = () => <TextField name="itrYearsFiled" label="Number of years ITR filed" type="number" />;

const GstStep = () => <TextField name="gstNumber" label="GSTIN" />;

const LoanStep = () => (
  <>
    <TextField name="loanAmount" label={`Loan amount (INR) — above ${HIGH_VALUE_LOAN} adds document steps`} type="number" />
    <TextField name="tenureMonths" label="Tenure (months)" type="number" />
  </>
);

const AddressProofStep = () => (
  <div style={{ marginBottom: 12 }}>
    <label htmlFor="addressProofType" style={{ display: 'block', fontWeight: 600 }}>
      Address proof
    </label>
    <Field as="select" id="addressProofType" name="addressProofType">
      <option value="">Select…</option>
      <option value="aadhaar">Aadhaar</option>
      <option value="passport">Passport</option>
      <option value="utility-bill">Utility bill</option>
    </Field>
    <ErrorMessage name="addressProofType" render={(msg) => <div style={{ color: '#c0392b' }}>{msg}</div>} />
  </div>
);

const BankStatementStep = () => <TextField name="bankName" label="Bank for 6-month statement" />;

const ReviewStep = ({ formik }: StepProps<V>) => {
  const { path } = useFormWorkflow<V>();
  const fieldsOnPath = new Set(path.flatMap((s) => s.fields ?? []));
  return (
    <>
      <dl>
        {Object.entries(formik.values)
          .filter(([key]) => fieldsOnPath.has(key))
          .map(([key, value]) => (
            <div key={key} style={{ display: 'flex', gap: 8 }}>
              <dt style={{ fontWeight: 600 }}>{key}:</dt>
              <dd style={{ margin: 0 }}>{`${value as string | number | boolean}`}</dd>
            </div>
          ))}
      </dl>
      <label>
        <Field type="checkbox" name="consent" /> I agree to the terms and authorise a credit check
      </label>
      <ErrorMessage name="consent" render={(msg) => <div style={{ color: '#c0392b' }}>{msg}</div>} />
    </>
  );
};

export const loanApplicationWorkflow: WorkflowNode<V>[] = [
  step<V>({
    id: 'applicant',
    title: 'Applicant',
    fields: ['fullName', 'mobile', 'pan'],
    component: ApplicantStep,
    validate: (v) => {
      const errors = required(v, [['fullName', 'Full name'], ['mobile', 'Mobile'], ['pan', 'PAN']]);
      if (v.mobile && !/^[6-9]\d{9}$/.test(v.mobile)) errors.mobile = 'Enter a valid 10-digit mobile number';
      if (v.pan && !/^[A-Z]{5}\d{4}[A-Z]$/i.test(v.pan)) errors.pan = 'Enter a valid PAN';
      return errors;
    },
  }),
  step<V>({
    id: 'employment',
    title: 'Employment',
    fields: ['employmentType'],
    component: EmploymentStep,
    validate: (v) => required(v, [['employmentType', 'Employment type']]),
  }),
  orSplit<V>('employment-split', [
    {
      id: 'salaried',
      when: (v) => v.employmentType === 'salaried',
      nodes: [
        step<V>({
          id: 'salary',
          title: 'Salary details',
          fields: ['employerName', 'monthlySalary'],
          component: SalaryStep,
          validate: (v) => {
            const errors = required(v, [['employerName', 'Employer'], ['monthlySalary', 'Salary']]);
            if (v.monthlySalary !== '' && (!Number.isFinite(v.monthlySalary) || v.monthlySalary <= 0)) {
              errors.monthlySalary = 'Enter a positive monthly salary';
            }
            return errors;
          },
          execute: async ({ values, signal }) => {
            const response = await fetch('/api/mock/verify-salary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ employerName: values.employerName, monthlySalary: values.monthlySalary }),
              signal,
            });
            if (!response.ok) throw new Error('Salary verification failed. Please try again.');
            const result: unknown = await response.json();
            if (!isSalaryVerification(result)) throw new Error('Invalid salary verification response');
            return result;
          },
        }),
        orSplit<V>('salary-split', [
          {
            id: 'low-salary',
            when: (_, results) => isSalaryVerification(results.salary) && results.salary.requiresCoApplicant,
            nodes: [
              step<V>({
                id: 'co-applicant',
                title: 'Co-applicant',
                fields: ['coApplicantName', 'coApplicantMobile'],
                component: CoApplicantStep,
                validate: (v) =>
                  required(v, [['coApplicantName', 'Co-applicant name'], ['coApplicantMobile', 'Co-applicant mobile']]),
              }),
            ],
          },
          {
            id: 'standard-salary',
            when: (_, results) => isSalaryVerification(results.salary) && !results.salary.requiresCoApplicant,
            nodes: [],
          },
        ]),
      ],
    },
    {
      id: 'self-employed',
      when: (v) => v.employmentType === 'self-employed',
      nodes: [
        step<V>({
          id: 'business',
          title: 'Business details',
          fields: ['businessName', 'yearsInBusiness'],
          component: BusinessStep,
          validate: (v) => required(v, [['businessName', 'Business name'], ['yearsInBusiness', 'Years in business']]),
        }),
        orSplit<V>('vintage-split', [
          {
            id: 'new-business',
            when: (v) => v.yearsInBusiness !== '' && Number(v.yearsInBusiness) < 3,
            nodes: [
              step<V>({
                id: 'itr',
                title: 'ITR details',
                fields: ['itrYearsFiled'],
                component: ItrStep,
                validate: (v) => required(v, [['itrYearsFiled', 'ITR years']]),
              }),
            ],
          },
          {
            id: 'established-business',
            nodes: [
              step<V>({
                id: 'gst',
                title: 'GST details',
                fields: ['gstNumber'],
                component: GstStep,
                validate: (v) => required(v, [['gstNumber', 'GSTIN']]),
              }),
            ],
          },
        ]),
      ],
    },
  ]),
  step<V>({
    id: 'loan',
    title: 'Loan requirement',
    fields: ['loanAmount', 'tenureMonths'],
    component: LoanStep,
    validate: (v) => {
      const errors = required(v, [['loanAmount', 'Loan amount'], ['tenureMonths', 'Tenure']]);
      if (v.loanAmount !== '' && Number(v.loanAmount) < 10000) errors.loanAmount = 'Minimum loan is INR 10,000';
      return errors;
    },
  }),
  andSplit<V>(
    'high-value-documents',
    [
      {
        id: 'address',
        nodes: [
          step<V>({
            id: 'address-proof',
            title: 'Address proof',
            fields: ['addressProofType'],
            component: AddressProofStep,
            validate: (v) => required(v, [['addressProofType', 'Address proof']]),
          }),
        ],
      },
      {
        id: 'bank',
        nodes: [
          step<V>({
            id: 'bank-statement',
            title: 'Bank statement',
            fields: ['bankName'],
            component: BankStatementStep,
            validate: (v) => required(v, [['bankName', 'Bank name']]),
          }),
        ],
      },
    ],
    (v) => Number(v.loanAmount) > HIGH_VALUE_LOAN
  ),
  step<V>({
    id: 'review',
    title: 'Review & consent',
    fields: ['consent'],
    component: ReviewStep,
    validate: (v) => (v.consent ? {} : { consent: 'Consent is required' }),
  }),
];

export function LoanApplicationLayout() {
  const { path, currentStep, currentIndex, isFirstStep, isLastStep, back, goTo, isExecuting, error } = useFormWorkflow<V>();
  const actionLabel = isLastStep ? 'Submit application' : 'Next';

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      <nav aria-label="Application steps" style={{ minWidth: 220 }}>
        <p style={{ fontWeight: 600 }}>
          Step {currentIndex + 1} of {path.length}
        </p>
        <ol style={{ paddingLeft: 20 }}>
          {path.map((s, index) => {
            const isCurrent = s.id === currentStep.id;
            const isDone = index < currentIndex;
            return (
              <li
                key={s.id}
                aria-current={isCurrent ? 'step' : undefined}
                style={{ fontWeight: isCurrent ? 700 : 400, color: isDone ? '#27ae60' : undefined }}
              >
                {isDone ? (
                  <button type="button" disabled={isExecuting} onClick={() => goTo(s.id)} style={{ all: 'unset', cursor: 'pointer', textDecoration: 'underline' }}>
                    {s.title}
                  </button>
                ) : (
                  s.title
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <section style={{ flex: 1 }}>
        <h2>{currentStep.title}</h2>
        <fieldset disabled={isExecuting} aria-busy={isExecuting} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <CurrentStep />
        </fieldset>
        {error && <p role="alert" style={{ color: '#c0392b' }}>{error.message}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {!isFirstStep && (
            <button type="button" disabled={isExecuting} onClick={back}>
              Back
            </button>
          )}
          <button type="submit" disabled={isExecuting}>{isExecuting ? 'Processing...' : actionLabel}</button>
        </div>
      </section>
    </div>
  );
}
