// T-002 kabul kriteri 5: migration CI pipeline'inda otomatik kosar.
// Workflow metin olarak degil, YAML olarak COZULEREK dogrulanir (yorum satirlari yanlis
// pozitif uretmesin diye — T-001'de kurulan kalip).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const CI_WORKFLOW_PATH = join(__dirname, '..', '.github', 'workflows', 'ci.yml');

interface WorkflowService {
  image?: string;
}

interface WorkflowStep {
  name?: string;
  run?: string;
}

interface WorkflowJob {
  services?: Record<string, WorkflowService>;
  env?: Record<string, string>;
  steps?: WorkflowStep[];
}

interface Workflow {
  jobs?: Record<string, WorkflowJob>;
}

function readWorkflow(): Workflow {
  return parse(readFileSync(CI_WORKFLOW_PATH, 'utf8')) as Workflow;
}

function jobsOf(): WorkflowJob[] {
  return Object.values(readWorkflow().jobs ?? {});
}

function runCommands(): string[] {
  return jobsOf()
    .flatMap((job) => job.steps ?? [])
    .map((step) => step.run)
    .filter((command): command is string => typeof command === 'string');
}

describe('CI pipeline veritabani migration adimlari', () => {
  it('postgres servisi tanimlar (migration gercek bir veritabaninda kosar)', () => {
    const images = jobsOf().flatMap((job) =>
      Object.values(job.services ?? {}).map((service) => service.image ?? ''),
    );

    expect(images).toEqual(expect.arrayContaining([expect.stringContaining('postgres:16')]));
  });

  it('is ortaminda DATABASE_URL tanimlidir', () => {
    const databaseUrls = jobsOf().map((job) => job.env?.DATABASE_URL);

    expect(databaseUrls).toEqual(
      expect.arrayContaining([expect.stringContaining('postgresql://')]),
    );
  });

  it('migration deploy adimini icerir', () => {
    expect(runCommands()).toEqual(
      expect.arrayContaining([expect.stringContaining('migrate:deploy')]),
    );
  });

  it('sablon seed adimini icerir', () => {
    expect(runCommands()).toEqual(
      expect.arrayContaining([expect.stringContaining('run seed --workspace @tutanak/api')]),
    );
  });

  it('prisma semasini dogrular ve sema-migration sapmasini kontrol eder', () => {
    const commands = runCommands();

    expect(commands).toEqual(expect.arrayContaining([expect.stringContaining('prisma:validate')]));
    expect(commands).toEqual(
      expect.arrayContaining([expect.stringContaining('prisma migrate diff')]),
    );
  });
});
