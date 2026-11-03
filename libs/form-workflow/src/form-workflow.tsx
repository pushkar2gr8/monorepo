import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Formik,
  getIn,
  setIn,
  setNestedObjectValues,
  useFormikContext,
  validateYupSchema,
  yupToFormErrors,
  type FormikConfig,
  type FormikErrors,
  type FormikValues,
} from 'formik';
import { assertUniqueStepIds, resolvePath } from './engine';
import type { StepNode, WorkflowNode, WorkflowResults, WorkflowState } from './types';

const WorkflowContext = createContext<WorkflowState<any> | null>(null);

export function useFormWorkflow<V extends FormikValues = FormikValues>(): WorkflowState<V> {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error('[form-workflow] useFormWorkflow must be used inside <FormWorkflow>');
  return ctx as WorkflowState<V>;
}

export function CurrentStep() {
  const workflow = useFormWorkflow();
  const formik = useFormikContext<FormikValues>();
  const { component: Step } = workflow.currentStep;
  return <Step formik={formik} step={workflow.currentStep} workflow={workflow} />;
}

async function validateStep<V extends FormikValues>(step: StepNode<V> | undefined, values: V) {
  if (!step) return {};
  let errors: FormikErrors<V> = {};
  if (step.validationSchema) {
    try {
      await validateYupSchema(values, step.validationSchema);
    } catch (err: any) {
      if (err?.name !== 'ValidationError') throw err;
      errors = yupToFormErrors(err);
    }
  }
  if (step.validate) errors = { ...errors, ...(await step.validate(values)) };
  if (!step.fields) return errors;
  return step.fields.reduce<FormikErrors<V>>((scoped, field) => {
    const error = getIn(errors, field);
    return error === undefined ? scoped : setIn(scoped, field, error);
  }, {});
}

export interface FormWorkflowProps<V extends FormikValues>
  extends Omit<FormikConfig<V>, 'validate' | 'validationSchema' | 'children' | 'component' | 'render'> {
  nodes: WorkflowNode<V>[];
  onStepChange?: (step: StepNode<V>, values: V) => void;
  /** Custom layout; use <CurrentStep /> and useFormWorkflow() inside. Defaults to a simple progress + nav layout. */
  children?: ReactNode;
}

export function FormWorkflow<V extends FormikValues>({
  nodes,
  onStepChange,
  children,
  ...formikConfig
}: Readonly<FormWorkflowProps<V>>) {
  useMemo(() => assertUniqueStepIds(nodes), [nodes]);
  const stepRef = useRef<StepNode<V> | undefined>(undefined);
  const validate = useCallback((values: V) => validateStep(stepRef.current, values), []);

  return (
    <Formik<V> {...formikConfig} validate={validate}>
      <WorkflowRunner nodes={nodes} stepRef={stepRef} onStepChange={onStepChange}>
        {children ?? <DefaultLayout />}
      </WorkflowRunner>
    </Formik>
  );
}

interface RunnerProps<V extends FormikValues> {
  nodes: WorkflowNode<V>[];
  stepRef: { current: StepNode<V> | undefined };
  onStepChange?: (step: StepNode<V>, values: V) => void;
  children: ReactNode;
}

function previousResults<V extends FormikValues>(path: StepNode<V>[], index: number, results: WorkflowResults) {
  return Object.fromEntries(path.slice(0, index)
    .filter((step) => Object.hasOwn(results, step.id))
    .map((step) => [step.id, results[step.id]]));
}

function WorkflowRunner<V extends FormikValues>({ nodes, stepRef, onStepChange, children }: Readonly<RunnerProps<V>>) {
  const formik = useFormikContext<V>();
  const [results, setResults] = useState<WorkflowResults>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const pending = useRef<AbortController | null>(null);
  const latestValues = useRef(formik.values);
  latestValues.current = formik.values;
  useEffect(() => () => { pending.current?.abort(); }, []);
  const path = useMemo(() => resolvePath(nodes, formik.values, results), [nodes, formik.values, results]);
  if (path.length === 0) throw new Error('[form-workflow] Workflow resolved to zero steps');

  // Visited step ids; the current step is the most recent one still on the resolved path.
  const [history, setHistory] = useState<string[]>([]);
  const currentIndex = useMemo(() => {
    for (let i = history.length - 1; i >= 0; i--) {
      const index = path.findIndex((s) => s.id === history[i]);
      if (index >= 0) return index;
    }
    return 0;
  }, [history, path]);

  const currentStep = path[currentIndex];
  stepRef.current = currentStep;
  const isLastStep = currentIndex === path.length - 1;

  const moveTo = useCallback((id: string) => {
    setHistory((h) => {
      const existing = h.lastIndexOf(id);
      return existing >= 0 ? h.slice(0, existing + 1) : [...h, id];
    });
  }, []);

  const { validateForm, setTouched, submitForm, touched } = formik;

  const next = useCallback(async () => {
    if (pending.current) return false;
    const controller = new AbortController();
    pending.current = controller;
    const values = formik.values;
    const isStale = () => controller.signal.aborted || latestValues.current !== values;
    setIsExecuting(true);
    setError(null);
    try {
      const errors = await validateForm(values);
      if (isStale()) return false;
      if (Object.keys(errors).length > 0) {
        await setTouched({ ...touched, ...setNestedObjectValues(errors, true) }, false);
        return false;
      }
      const nextResults = previousResults(path, currentIndex, results);
      if (currentStep.execute) {
        const response = await currentStep.execute({ values, results: nextResults, signal: controller.signal });
        if (isStale()) return false;
        nextResults[currentStep.id] = response;
      }
      const nextPath = resolvePath(nodes, values, nextResults);
      const stepIndex = nextPath.findIndex((step) => step.id === currentStep.id);
      if (stepIndex < 0) throw new Error('The active step must remain on the route after execution');
      setResults(nextResults);
      if (stepIndex === nextPath.length - 1) {
        await submitForm();
      } else {
        moveTo(nextPath[stepIndex + 1].id);
      }
      return !isStale();
    } catch (error_) {
      if (!isStale()) setError(error_ instanceof Error ? error_ : new Error(String(error_)));
      return false;
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setIsExecuting(false);
      }
    }
  }, [validateForm, setTouched, submitForm, touched, moveTo, path, currentIndex, currentStep, nodes, results, formik.values]);

  const back = useCallback(() => {
    if (!pending.current && currentIndex > 0) {
      setError(null);
      moveTo(path[currentIndex - 1].id);
    }
  }, [currentIndex, moveTo, path]);

  const goTo = useCallback(
    (stepId: string) => {
      const index = path.findIndex((s) => s.id === stepId);
      if (!pending.current && index >= 0 && index <= currentIndex) {
        setError(null);
        moveTo(stepId);
      }
    },
    [path, currentIndex, moveTo]
  );

  const valuesRef = useRef(formik.values);
  valuesRef.current = formik.values;
  useEffect(() => {
    onStepChange?.(currentStep, valuesRef.current);
    // Fire only when the active step changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep.id]);

  const state = useMemo<WorkflowState<V>>(
    () => ({
      path,
      currentStep,
      currentIndex,
      isFirstStep: currentIndex === 0,
      isLastStep,
      results,
      isExecuting,
      error,
      next,
      back,
      goTo,
    }),
    [path, currentStep, currentIndex, isLastStep, results, isExecuting, error, next, back, goTo]
  );

  return (
    <WorkflowContext.Provider value={state}>
      <form
        noValidate
        onSubmit={(event) => {
          // Enter key should advance the workflow, not submit mid-way.
          event.preventDefault();
          void next();
        }}
        onReset={(event) => {
          event.preventDefault();
          pending.current?.abort();
          pending.current = null;
          setIsExecuting(false);
          setError(null);
          setResults({});
          formik.resetForm();
          setHistory([]);
        }}
      >
        {children}
      </form>
    </WorkflowContext.Provider>
  );
}

function DefaultLayout() {
  const { path, currentStep, currentIndex, isFirstStep, isLastStep, back, goTo, isExecuting, error } = useFormWorkflow();
  const { isSubmitting } = useFormikContext();
  const actionLabel = isLastStep ? 'Submit' : 'Next';

  return (
    <>
      <ol aria-label="Progress">
        {path.map((s, index) => (
          <li key={s.id} aria-current={s.id === currentStep.id ? 'step' : undefined}>
            {index < currentIndex ? (
              <button type="button" disabled={isExecuting} onClick={() => goTo(s.id)}>
                {s.title ?? s.id}
              </button>
            ) : (
              s.title ?? s.id
            )}
          </li>
        ))}
      </ol>
      <p>
        Step {currentIndex + 1} of {path.length}
      </p>
      {currentStep.title && <h2>{currentStep.title}</h2>}
      <CurrentStep />
      {error && <p role="alert">{error.message}</p>}
      <div>
        {!isFirstStep && (
          <button type="button" disabled={isExecuting} onClick={back}>
            Back
          </button>
        )}
        <button type="submit" disabled={isSubmitting || isExecuting}>
          {isExecuting ? 'Processing...' : actionLabel}
        </button>
      </div>
    </>
  );
}
