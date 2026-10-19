import type { Bundle } from './contracts.js';

export type ValidationSeverity = 'error' | 'warning';
export type ValidationIssue = {
  code: string;
  severity: ValidationSeverity;
  message: string;
  requirementID?: string;
  taskID?: string;
};
export type RequirementCoverage = {
  requirementID: string;
  taskIDs: string[];
  acceptance: { taskID: string; criterion: string }[];
  checks: { taskID: string; name: string; argv: string[] }[];
};
export type ValidationReport = {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  requirements: RequirementCoverage[];
};

/**
 * Produces deterministic, human-reviewable quality findings after the strict
 * schema/DAG parser has accepted a bundle. This deliberately contains no
 * model judgment: a person acknowledges the small set of semantic warnings.
 */
export function validateBundle(bundle: Bundle): ValidationReport {
  const warnings: ValidationIssue[] = [];
  const requirements = [...bundle.spec.requirements]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(requirement => {
      const tasks = bundle.plan.tasks
        .filter(task => task.requirements.includes(requirement.id))
        .sort((left, right) => left.id.localeCompare(right.id));
      const acceptance = tasks.flatMap(task => task.acceptance.map(criterion => ({ taskID: task.id, criterion })));
      const checks = tasks.flatMap(task => task.checks.map(name => ({ taskID: task.id, name, argv: [...bundle.config.checks[name]!] })));
      if (!tasks.some(task => task.kind === 'implementation')) {
        warnings.push({
          code: 'QUALITY_REQUIREMENT_RESEARCH_ONLY',
          severity: 'warning',
          requirementID: requirement.id,
          message: `${requirement.id} is assigned only to research tasks and has no implementation owner`,
        });
      }
      if (!checks.length) {
        warnings.push({
          code: 'QUALITY_REQUIREMENT_NO_CHECKS',
          severity: 'warning',
          requirementID: requirement.id,
          message: `${requirement.id} has no configured check through its assigned tasks`,
        });
      }
      return { requirementID: requirement.id, taskIDs: tasks.map(task => task.id), acceptance, checks };
    });
  for (const task of [...bundle.plan.tasks].sort((left, right) => left.id.localeCompare(right.id))) {
    if (task.acceptance.some(criterion => /(?:^|\b)(?:todo|tbd|placeholder)(?:\b|$)/i.test(criterion))) {
      warnings.push({
        code: 'QUALITY_ACCEPTANCE_PLACEHOLDER',
        severity: 'warning',
        taskID: task.id,
        message: `${task.id} contains a placeholder acceptance criterion`,
      });
    }
  }
  warnings.sort((left, right) => `${left.code}:${left.requirementID ?? ''}:${left.taskID ?? ''}`.localeCompare(`${right.code}:${right.requirementID ?? ''}:${right.taskID ?? ''}`));
  return { ok: true, errors: [], warnings, requirements };
}

export function warningCodes(report: ValidationReport): string[] {
  return [...new Set(report.warnings.map(warning => warning.code))].sort((left, right) => left.localeCompare(right));
}

export function structuralValidationReport(message: string): ValidationReport {
  return {
    ok: false,
    errors: [{ code: 'STRUCTURAL_INVALID', severity: 'error', message }],
    warnings: [],
    requirements: [],
  };
}
