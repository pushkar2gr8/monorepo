import type { ComponentType } from 'react';
import type { FormikErrors, FormikProps, FormikValues } from 'formik';

export type WorkflowResults = Readonly<Record<string, unknown>>;

export interface StepExecutionContext<V> {
  values: V;
  results: WorkflowResults;
  signal: AbortSignal;
}

export type Condition<V> = (values: V, results: WorkflowResults) => boolean;

export interface StepProps<V extends FormikValues = FormikValues> {
  formik: FormikProps<V>;
  step: StepNode<V>;
  workflow: WorkflowState<V>;
}

export interface StepNode<V extends FormikValues = FormikValues> {
  type: 'step';
  id: string;
  title?: string;
  /** Step is skipped when this returns false. */
  when?: Condition<V>;
  /** Field paths owned by this step; only their errors block "Next". Defaults to all errors. */
  fields?: string[];
  validate?: (values: V) => FormikErrors<V> | Promise<FormikErrors<V>>;
  execute?: (context: StepExecutionContext<V>) => Promise<unknown>;
  /** Yup (or Yup-compatible) schema scoped to this step. */
  validationSchema?: unknown;
  component: ComponentType<StepProps<V>>;
}

export interface Branch<V extends FormikValues = FormikValues> {
  id: string;
  label?: string;
  /** OR split: first branch whose condition passes wins; a branch without `when` is the default.
   *  AND split: branch is included when the condition passes (or is absent). */
  when?: Condition<V>;
  nodes: WorkflowNode<V>[];
}

/** Exclusive branching: exactly one branch is followed (AEM "OR Split"). */
export interface OrSplitNode<V extends FormikValues = FormikValues> {
  type: 'or-split';
  id: string;
  when?: Condition<V>;
  branches: Branch<V>[];
}

/** Every branch is followed, in declaration order (AEM "AND Split"). */
export interface AndSplitNode<V extends FormikValues = FormikValues> {
  type: 'and-split';
  id: string;
  when?: Condition<V>;
  branches: Branch<V>[];
}

export type WorkflowNode<V extends FormikValues = FormikValues> =
  | StepNode<V>
  | OrSplitNode<V>
  | AndSplitNode<V>;

export interface WorkflowState<V extends FormikValues = FormikValues> {
  /** Steps on the currently resolved route; recomputed whenever values change. */
  path: StepNode<V>[];
  currentStep: StepNode<V>;
  currentIndex: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  results: WorkflowResults;
  isExecuting: boolean;
  error: Error | null;
  /** Validates the current step, then advances (or submits on the last step). Resolves true if it moved/submitted. */
  next: () => Promise<boolean>;
  back: () => void;
  /** Jump to an earlier step on the current path. */
  goTo: (stepId: string) => void;
}
