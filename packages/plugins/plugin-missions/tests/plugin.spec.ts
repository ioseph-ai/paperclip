import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Agent, Issue } from "@paperclipai/plugin-sdk";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import { pluginManifestV1Schema } from "@paperclipai/shared";
import manifest, { MISSIONS_PAGE_ROUTE, MISSIONS_UI_EXPORTS } from "../src/manifest.js";
import plugin from "../src/worker.js";

function issue(input: Partial<Issue> & Pick<Issue, "id" | "companyId" | "title">): Issue {
  const now = new Date();
  const { id, companyId, title, ...rest } = input;
  return {
    id,
    companyId,
    projectId: null,
    projectWorkspaceId: null,
    goalId: null,
    parentId: null,
    title,
    description: null,
    status: "todo",
    priority: "medium",
    assigneeAgentId: null,
    assigneeUserId: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    createdByAgentId: null,
    createdByUserId: null,
    issueNumber: null,
    identifier: null,
    originKind: "manual",
    originId: null,
    originRunId: null,
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceId: null,
    executionWorkspacePreference: null,
    executionWorkspaceSettings: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    createdAt: now,
    updatedAt: now,
    ...rest,
  };
}

function agent(input: Partial<Agent> & Pick<Agent, "id" | "companyId" | "name" | "status">): Agent {
  const now = new Date();
  const { id, companyId, name, status, ...rest } = input;
  return {
    id,
    companyId,
    name,
    urlKey: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    role: "engineer",
    title: null,
    icon: null,
    status,
    reportsTo: null,
    capabilities: null,
    adapterType: "codex_local",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 100000,
    spentMonthlyCents: 0,
    pauseReason: null,
    pausedAt: null,
    permissions: { canCreateAgents: false },
    lastHeartbeatAt: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    ...rest,
  };
}

function validationContractDocument() {
  return JSON.stringify({
    assertions: [
      {
        id: "VAL-MISSION-001",
        title: "Mission value is preserved",
        user_value: "The shipped workflow produces a visible mission outcome.",
        scope: "Mission workflow",
        setup: "Open the mission root issue.",
        steps: ["Run the workflow"],
        oracle: "Generated work is visible and bounded.",
        tooling: ["manual_review"],
        evidence: [{ kind: "screenshot", description: "Mission workflow evidence", required: true }],
        claimed_by: ["FEAT-MISSION-001"],
        status: "claimed",
      },
    ],
  });
}

function featuresDocument() {
  return JSON.stringify({
    milestones: [
      {
        id: "MILESTONE-MISSION-001",
        title: "Workflow wiring",
        summary: "Expose the mission workflow through plugin routes and actions.",
        depends_on: [],
        features: [
          {
            id: "FEAT-MISSION-001",
            title: "Route and action wiring",
            kind: "original",
            summary: "Wire the worker entrypoints.",
            acceptance_criteria: ["The route and action handlers dispatch successfully."],
            claimed_assertion_ids: ["VAL-MISSION-001"],
            depends_on: [],
            status: "planned",
          },
        ],
      },
    ],
  });
}

function validationReportWithBlockingFinding() {
  return JSON.stringify({
    round: 1,
    validator_role: "scrutiny_validator",
    summary: "One blocking issue remains.",
    findings: [
      {
        id: "FINDING-MISSION-001",
        severity: "blocking",
        assertion_id: "VAL-MISSION-001",
        title: "Workflow action is missing",
        evidence: ["Action endpoint returned a missing handler error."],
        repro_steps: ["Call the advance action."],
        expected: "The action dispatches to the workflow.",
        actual: "The worker reports no handler.",
        suspected_area: "Missions worker",
        recommended_fix_scope: "Register the missing action handler.",
        status: "open",
      },
    ],
  });
}

describe("missions plugin manifest", () => {
  it("declares the page, issue panel, global toolbar, settings, and dashboard surfaces", () => {
    expect(manifest.id).toBe("paperclip.missions");
    expect(pluginManifestV1Schema.parse(manifest)).toMatchObject({
      id: "paperclip.missions",
      database: {
        namespaceSlug: "missions",
        migrationsDir: "migrations",
        coreReadTables: ["issues"],
      },
      apiRoutes: expect.arrayContaining([
        expect.objectContaining({ routeKey: "init", path: "/issues/:issueId/missions/init" }),
        expect.objectContaining({ routeKey: "summary", path: "/issues/:issueId/missions/summary" }),
        expect.objectContaining({ routeKey: "decompose", path: "/issues/:issueId/missions/decompose" }),
        expect.objectContaining({ routeKey: "advance", path: "/issues/:issueId/missions/advance" }),
        expect.objectContaining({ routeKey: "waive", path: "/issues/:issueId/missions/findings/:findingKey/waive" }),
        expect.objectContaining({ routeKey: "list", path: "/missions" }),
      ]),
    });
    expect(manifest.capabilities).toEqual(
      expect.arrayContaining([
        "api.routes.register",
        "database.namespace.migrate",
        "database.namespace.read",
        "database.namespace.write",
        "issues.read",
        "issues.create",
        "issues.update",
        "issues.checkout",
        "issues.wakeup",
        "issue.relations.write",
        "issue.comments.create",
        "issue.documents.read",
        "issue.documents.write",
        "issue.subtree.read",
        "issues.orchestration.read",
        "plugin.state.read",
        "plugin.state.write",
        "ui.page.register",
        "ui.detailTab.register",
        "ui.action.register",
        "ui.dashboardWidget.register",
        "instance.settings.register",
      ]),
    );
    expect(manifest.ui?.slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "page", routePath: MISSIONS_PAGE_ROUTE, exportName: MISSIONS_UI_EXPORTS.page }),
        expect.objectContaining({ type: "taskDetailView", exportName: MISSIONS_UI_EXPORTS.taskDetailView }),
        expect.objectContaining({ type: "globalToolbarButton", exportName: MISSIONS_UI_EXPORTS.globalToolbarButton }),
        expect.objectContaining({ type: "settingsPage", exportName: MISSIONS_UI_EXPORTS.settingsPage }),
        expect.objectContaining({ type: "dashboardWidget", exportName: MISSIONS_UI_EXPORTS.dashboardWidget }),
      ]),
    );
  });
});

describe("missions plugin worker", () => {
  it("initializes missions, projects summaries, and persists company mission settings", async () => {
    const companyId = randomUUID();
    const rootIssueId = randomUUID();
    const workerAgentId = randomUUID();
    const validatorAgentId = randomUUID();
    const harness = createTestHarness({ manifest });

    harness.seed({
      issues: [
        issue({
          id: rootIssueId,
          companyId,
          title: "Ship plugin mission surfaces",
          identifier: "PAP-1688",
        }),
      ],
      agents: [
        agent({ id: workerAgentId, companyId, name: "Worker One", status: "idle" }),
        agent({ id: validatorAgentId, companyId, name: "Validator One", status: "active" }),
      ],
    });

    await plugin.definition.setup(harness.ctx);

    const before = await harness.getData("mission-panel", { companyId, issueId: rootIssueId });
    expect(before).toMatchObject({
      mode: "not_mission",
      issue: {
        id: rootIssueId,
        title: "Ship plugin mission surfaces",
      },
      availableCommands: [expect.objectContaining({ key: "initialize", enabled: true })],
    });

    const initialized = await harness.performAction<Record<string, unknown>>("initialize-mission", {
      companyId,
      issueId: rootIssueId,
    });
    expect(initialized).toMatchObject({
      mode: "mission",
      missionRootIssueId: rootIssueId,
      summary: {
        missionIssueId: rootIssueId,
        missionTitle: "Ship plugin mission surfaces",
        state: "planning",
      },
    });

    const summary = await harness.getData<Record<string, unknown>>("mission-summary", {
      companyId,
      issueId: rootIssueId,
    });
    expect(summary).toMatchObject({
      missionIssueId: rootIssueId,
      missionTitle: "Ship plugin mission surfaces",
      state: "planning",
      documentChecklist: expect.any(Array),
      blockers: expect.any(Array),
      validationSummary: expect.objectContaining({
        counts: expect.objectContaining({
          total: 0,
        }),
      }),
      runSummary: expect.objectContaining({
        total: 0,
      }),
      costSummary: expect.objectContaining({
        costCents: 0,
      }),
      governanceStops: expect.any(Array),
      nextAction: expect.any(String),
    });

    const list = await harness.getData<Array<Record<string, unknown>>>("mission-list", { companyId });
    expect(list).toEqual([
      expect.objectContaining({
        missionIssueId: rootIssueId,
        missionTitle: "Ship plugin mission surfaces",
        state: "planning",
      }),
    ]);

    const savedSettings = await harness.performAction<Record<string, unknown>>("save-mission-settings", {
      companyId,
      maxValidationRounds: 4,
      requireBlackBoxValidation: false,
      defaultWorkerAgentId: workerAgentId,
      defaultValidatorAgentId: validatorAgentId,
      defaultBillingCodePolicy: "stable-prefix",
      autoAdvance: true,
    });
    expect(savedSettings).toMatchObject({
      maxValidationRounds: 4,
      requireBlackBoxValidation: false,
      defaultWorkerAgentId: workerAgentId,
      defaultValidatorAgentId: validatorAgentId,
      defaultBillingCodePolicy: "stable-prefix",
      autoAdvance: true,
    });

    const storedSettings = await harness.getData<Record<string, unknown>>("mission-settings", { companyId });
    expect(storedSettings).toMatchObject(savedSettings);

    const listedAgents = await harness.getData<Array<Record<string, unknown>>>("mission-agents", { companyId });
    expect(listedAgents).toEqual([
      expect.objectContaining({ id: validatorAgentId, name: "Validator One" }),
      expect.objectContaining({ id: workerAgentId, name: "Worker One" }),
    ]);
  });

  it("lists persisted mission roots when host issue timestamps are serialized strings", async () => {
    const companyId = randomUUID();
    const rootIssueId = randomUUID();
    const updatedAt = "2026-04-20T12:00:00.000Z";
    const harness = createTestHarness({ manifest });

    harness.seed({
      issues: [
        issue({
          id: rootIssueId,
          companyId,
          title: "Persisted mission root",
          identifier: "PAP-1691",
          originKind: "plugin:paperclip.missions",
          updatedAt: updatedAt as unknown as Date,
        }),
      ],
    });

    await plugin.definition.setup(harness.ctx);

    const list = await harness.getData<Array<Record<string, unknown>>>("mission-list", { companyId });
    expect(list).toEqual([
      expect.objectContaining({
        missionIssueId: rootIssueId,
        missionTitle: "Persisted mission root",
        updatedAt,
      }),
    ]);
  });

  it("dispatches the documented scoped API routes", async () => {
    const companyId = randomUUID();
    const rootIssueId = randomUUID();
    const harness = createTestHarness({ manifest });

    harness.seed({
      issues: [
        issue({
          id: rootIssueId,
          companyId,
          title: "Scoped API mission root",
          identifier: "PAP-1700",
        }),
      ],
    });

    await plugin.definition.setup(harness.ctx);

    await expect(plugin.definition.onApiRequest?.({
      routeKey: "init",
      method: "POST",
      path: `/issues/${rootIssueId}/missions/init`,
      params: { issueId: rootIssueId },
      query: {},
      body: {},
      actor: {
        actorType: "user",
        actorId: "board",
        userId: "board",
        agentId: null,
        runId: null,
      },
      companyId,
      headers: {},
    })).resolves.toMatchObject({
      status: 201,
      body: expect.objectContaining({
        mode: "mission",
        missionRootIssueId: rootIssueId,
      }),
    });

    await expect(plugin.definition.onApiRequest?.({
      routeKey: "summary",
      method: "GET",
      path: `/issues/${rootIssueId}/missions/summary`,
      params: { issueId: rootIssueId },
      query: {},
      body: null,
      actor: {
        actorType: "user",
        actorId: "board",
        userId: "board",
        agentId: null,
        runId: null,
      },
      companyId,
      headers: {},
    })).resolves.toMatchObject({
      body: expect.objectContaining({
        missionIssueId: rootIssueId,
      }),
    });

    await expect(plugin.definition.onApiRequest?.({
      routeKey: "list",
      method: "GET",
      path: "/missions",
      params: {},
      query: { companyId },
      body: null,
      actor: {
        actorType: "user",
        actorId: "board",
        userId: "board",
        agentId: null,
        runId: null,
      },
      companyId,
      headers: {},
    })).resolves.toMatchObject({
      body: [expect.objectContaining({ missionIssueId: rootIssueId })],
    });
  });

  it("registers decompose action and syncs generated issues idempotently", async () => {
    const companyId = randomUUID();
    const rootIssueId = randomUUID();
    const harness = createTestHarness({ manifest });

    harness.seed({
      issues: [
        issue({
          id: rootIssueId,
          companyId,
          title: "Idempotent mission decomposition",
          identifier: "PAP-1701",
          originKind: "plugin:paperclip.missions",
          originId: "PAP-1701",
        }),
      ],
    });

    await plugin.definition.setup(harness.ctx);
    await harness.ctx.issues.documents.upsert({
      issueId: rootIssueId,
      companyId,
      key: "validation-contract",
      title: "Validation Contract",
      format: "markdown",
      body: validationContractDocument(),
      changeSummary: "Seed validation contract",
    });
    await harness.ctx.issues.documents.upsert({
      issueId: rootIssueId,
      companyId,
      key: "features",
      title: "Features",
      format: "markdown",
      body: featuresDocument(),
      changeSummary: "Seed features",
    });

    const first = await harness.performAction<{ createdIssueIds: string[]; updatedIssueIds: string[] }>("decompose", {
      companyId,
      issueId: rootIssueId,
    });
    const second = await harness.performAction<{ createdIssueIds: string[]; updatedIssueIds: string[] }>("decompose", {
      companyId,
      issueId: rootIssueId,
    });

    expect(first.createdIssueIds).toHaveLength(3);
    expect(first.updatedIssueIds).toHaveLength(0);
    expect(second.createdIssueIds).toHaveLength(0);
    expect(second.updatedIssueIds).toHaveLength(3);

    const generated = await harness.ctx.issues.list({ companyId, limit: 50 });
    expect(generated.filter((item) => item.originKind?.startsWith("plugin:paperclip.missions:"))).toHaveLength(3);
  });

  it("registers advance and waive actions without duplicating fix issues", async () => {
    const companyId = randomUUID();
    const rootIssueId = randomUUID();
    const workerAgentId = randomUUID();
    const harness = createTestHarness({ manifest });

    harness.seed({
      issues: [
        issue({
          id: rootIssueId,
          companyId,
          title: "Mission with one blocking finding",
          identifier: "PAP-1702",
          assigneeAgentId: workerAgentId,
          originKind: "plugin:paperclip.missions",
          originId: "PAP-1702",
          billingCode: "mission:PAP-1702",
        }),
      ],
      agents: [agent({ id: workerAgentId, companyId, name: "Worker One", status: "active" })],
    });

    await plugin.definition.setup(harness.ctx);
    for (const [key, body] of Object.entries({
      "validation-contract": validationContractDocument(),
      features: featuresDocument(),
      "validation-report-round-1": validationReportWithBlockingFinding(),
      "decision-log": "# Decision Log",
    })) {
      await harness.ctx.issues.documents.upsert({
        issueId: rootIssueId,
        companyId,
        key,
        title: key,
        format: "markdown",
        body,
        changeSummary: `Seed ${key}`,
      });
    }

    const originalList = harness.ctx.issues.documents.list;
    harness.ctx.issues.documents.list = async (...args) =>
      (await originalList(...args)).map((summary) => ({
        ...summary,
        createdAt: summary.createdAt.toISOString(),
        updatedAt: summary.updatedAt.toISOString(),
      })) as unknown as Awaited<ReturnType<typeof originalList>>;

    const originalUpsert = harness.ctx.issues.documents.upsert;
    const documentUpdates: Array<{ key: string; baseRevisionId: string | null | undefined }> = [];
    harness.ctx.issues.documents.upsert = async (input) => {
      const existing = await harness.ctx.issues.documents.get(input.issueId, input.key, input.companyId);
      if (existing && input.baseRevisionId !== existing.latestRevisionId) {
        throw new Error(
          input.baseRevisionId ? "Document was updated by someone else" : "Document update requires baseRevisionId",
        );
      }
      documentUpdates.push({ key: input.key, baseRevisionId: input.baseRevisionId });
      return originalUpsert(input);
    };

    const first = await harness.performAction<{ createdFixIssueIds: string[] }>("advance", {
      companyId,
      issueId: rootIssueId,
    });
    const second = await harness.performAction<{ createdFixIssueIds: string[] }>("advance", {
      companyId,
      issueId: rootIssueId,
    });

    expect(first.createdFixIssueIds).toHaveLength(1);
    expect(second.createdFixIssueIds).toEqual(first.createdFixIssueIds);

    const generated = await harness.ctx.issues.list({ companyId, limit: 50 });
    expect(generated.filter((item) => item.originKind === "plugin:paperclip.missions:fix")).toHaveLength(1);

    const summaryResponse = await plugin.definition.onApiRequest?.({
      routeKey: "summary",
      method: "GET",
      path: `/issues/${rootIssueId}/missions/summary`,
      params: { issueId: rootIssueId },
      query: {},
      body: null,
      actor: { actorType: "agent", actorId: workerAgentId, agentId: workerAgentId, runId: "run-test" },
      companyId,
      headers: {},
    });
    expect(summaryResponse?.body).toMatchObject({
      validationSummary: expect.objectContaining({
        findings: [expect.objectContaining({ id: "FINDING-MISSION-001", computedStatus: "fix_created" })],
      }),
    });

    const waiverResponse = await plugin.definition.onApiRequest?.({
      routeKey: "waive",
      method: "POST",
      path: `/issues/${rootIssueId}/missions/findings/FINDING-MISSION-001/waive`,
      params: { issueId: rootIssueId, findingKey: "FINDING-MISSION-001" },
      query: {},
      body: { rationale: "Accepted temporarily for test coverage." },
      actor: { actorType: "agent", actorId: workerAgentId, agentId: workerAgentId, runId: "run-test" },
      companyId,
      headers: {},
    });
    expect(waiverResponse?.body).toMatchObject({
      findingId: "FINDING-MISSION-001",
      waived: true,
    });

    const decisionLog = await harness.ctx.issues.documents.get(rootIssueId, "decision-log", companyId);
    expect(decisionLog?.body).toContain("paperclip:mission-finding-waiver:FINDING-MISSION-001");
    expect(decisionLog?.body).toContain("Accepted temporarily for test coverage.");
    expect(documentUpdates.filter((update) => update.key === "decision-log")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ baseRevisionId: expect.any(String) }),
      ]),
    );
  });
});
