import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const CI_WORKFLOW_PATH = join(__dirname, '..', '.github', 'workflows', 'ci.yml');

interface WorkflowStep {
  name?: string;
  uses?: string;
  run?: string;
}

interface WorkflowJob {
  'runs-on'?: string;
  steps?: WorkflowStep[];
}

interface Workflow {
  name?: string;
  // `on` YAML 1.1'de boolean'a cozulebildigi icin iki anahtar da kontrol edilir.
  on?: Record<string, unknown> | string[] | string;
  true?: Record<string, unknown> | string[] | string;
  jobs?: Record<string, WorkflowJob>;
}

function readWorkflow(): Workflow {
  return parse(readFileSync(CI_WORKFLOW_PATH, 'utf8')) as Workflow;
}

function triggersOf(workflow: Workflow): string[] {
  const raw = workflow.on ?? workflow.true;
  if (typeof raw === 'string') {
    return [raw];
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  return Object.keys(raw ?? {});
}

function runCommandsOf(workflow: Workflow): string[] {
  return Object.values(workflow.jobs ?? {})
    .flatMap((job) => job.steps ?? [])
    .map((step) => step.run)
    .filter((command): command is string => typeof command === 'string');
}

describe('CI workflow (.github/workflows/ci.yml)', () => {
  it('repo icinde mevcuttur ve gecerli YAML olarak cozulur', () => {
    expect(existsSync(CI_WORKFLOW_PATH)).toBe(true);

    const workflow = readWorkflow();

    expect(typeof workflow).toBe('object');
    expect(workflow.name).toBeTruthy();
  });

  it('her push ve pull request tetikleyicisinde otomatik calisir', () => {
    const triggers = triggersOf(readWorkflow());

    expect(triggers).toContain('push');
    expect(triggers).toContain('pull_request');
  });

  it('lint adimini icerir', () => {
    const commands = runCommandsOf(readWorkflow());

    expect(commands).toEqual(expect.arrayContaining([expect.stringContaining('npm run lint')]));
  });

  it('test adimini icerir', () => {
    const commands = runCommandsOf(readWorkflow());

    expect(commands).toEqual(expect.arrayContaining([expect.stringContaining('npm run test')]));
  });

  it('build adimini icerir', () => {
    const commands = runCommandsOf(readWorkflow());

    expect(commands).toEqual(expect.arrayContaining([expect.stringContaining('npm run build')]));
  });

  it('en az bir is tanimlar ve her isin calisma ortami ile adimlari vardir', () => {
    const jobs = Object.values(readWorkflow().jobs ?? {});

    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) {
      expect(job['runs-on']).toBeTruthy();
      expect(job.steps?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('bagimliliklari kilit dosyasindan kurar (npm ci)', () => {
    const commands = runCommandsOf(readWorkflow());

    expect(commands).toEqual(expect.arrayContaining([expect.stringContaining('npm ci')]));
  });
});
