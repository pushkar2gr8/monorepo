import type { FormikValues } from 'formik';
import type {
  AndSplitNode,
  Branch,
  OrSplitNode,
  StepNode,
  WorkflowNode,
  WorkflowResults,
} from './types';

export const step = <V extends FormikValues>(config: Omit<StepNode<V>, 'type'>): StepNode<V> => ({
  type: 'step',
  ...config,
});

export const orSplit = <V extends FormikValues>(
  id: string,
  branches: Branch<V>[],
  when?: OrSplitNode<V>['when']
): OrSplitNode<V> => ({ type: 'or-split', id, branches, when });

export const andSplit = <V extends FormikValues>(
  id: string,
  branches: Branch<V>[],
  when?: AndSplitNode<V>['when']
): AndSplitNode<V> => ({ type: 'and-split', id, branches, when });

function selectOrBranch<V extends FormikValues>(node: OrSplitNode<V>, values: V, results: WorkflowResults) {
  return (
    node.branches.find((branch) => branch.when?.(values, results)) ??
    node.branches.find((branch) => !branch.when)
  );
}

/** Flattens the workflow tree into the ordered list of steps reachable with the given values. */
export function resolvePath<V extends FormikValues>(
  nodes: WorkflowNode<V>[], values: V, results: WorkflowResults = {}
): StepNode<V>[] {
  const path: StepNode<V>[] = [];
  for (const node of nodes) {
    if (node.when && !node.when(values, results)) continue;
    switch (node.type) {
      case 'step':
        path.push(node);
        break;
      case 'or-split': {
        const branch = selectOrBranch(node, values, results);
        if (branch) path.push(...resolvePath(branch.nodes, values, results));
        break;
      }
      case 'and-split':
        for (const branch of node.branches) {
          if (branch.when?.(values, results) !== false) path.push(...resolvePath(branch.nodes, values, results));
        }
        break;
    }
  }
  return path;
}

/** Throws if any step id is reused anywhere in the tree, since ids drive navigation. */
export function assertUniqueStepIds<V extends FormikValues>(nodes: WorkflowNode<V>[], seen = new Set<string>()) {
  for (const node of nodes) {
    if (node.type === 'step') {
      if (seen.has(node.id)) throw new Error(`[form-workflow] Duplicate step id "${node.id}"`);
      seen.add(node.id);
    } else {
      for (const branch of node.branches) assertUniqueStepIds(branch.nodes, seen);
    }
  }
}
