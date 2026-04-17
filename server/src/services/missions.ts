import type { Db } from "@paperclipai/db";
import {
  parseMissionFeaturesDocument,
  parseMissionValidationContractDocument,
  type Issue,
  type IssueOriginKind,
  type MissionDecomposedIssue,
  type MissionDecompositionResult,
  type MissionFeaturesDocument,
} from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";
import { documentService } from "./documents.js";
import { issueService } from "./issues.js";

const GENERATED_ORIGIN_KIND_BY_RESULT_KIND = {
  milestone: "mission_milestone",
  feature: "mission_feature",
  validation: "mission_validation",
  fix_loop: "mission_fix_loop",
} as const satisfies Record<MissionDecomposedIssue["kind"], IssueOriginKind>;

type GeneratedIssueSpec = {
  kind: MissionDecomposedIssue["kind"];
  key: string;
  originKind: IssueOriginKind;
  originId: string;
  title: string;
  description: string;
  parentId: string;
  status: "todo" | "blocked";
  priority: "medium";
  blockedByIssueIds: string[];
};

type ActorInfo = {
  agentId?: string | null;
  userId?: string | null;
};
type MissionIssue = Pick<
  Issue,
  | "id"
  | "identifier"
  | "companyId"
  | "projectId"
  | "projectWorkspaceId"
  | "goalId"
  | "billingCode"
  | "executionWorkspaceId"
  | "executionWorkspacePreference"
  | "executionWorkspaceSettings"
>;
type GeneratedIssueRow = {
  id: string;
  identifier: string | null;
  title: string;
};

function missionOriginId(missionIssueId: string, kind: MissionDecomposedIssue["kind"], key: string) {
  return `${missionIssueId}:${kind}:${key}`;
}

function issueReference(issue: Pick<Issue, "identifier" | "id">) {
  if (!issue.identifier) return `\`${issue.id}\``;
  const prefix = issue.identifier.split("-")[0] || "PAP";
  return `[${issue.identifier}](/${prefix}/issues/${issue.identifier})`;
}

function buildFeatureDescription(input: {
  mission: Pick<Issue, "id" | "identifier">;
  milestone: MissionFeaturesDocument["milestones"][number];
  feature: MissionFeaturesDocument["milestones"][number]["features"][number];
}) {
  const { mission, milestone, feature } = input;
  return [
    `Mission feature generated from ${issueReference(mission)}.`,
    "",
    `Mission key: \`${feature.id}\``,
    `Milestone: \`${milestone.id}\` ${milestone.title}`,
    `Kind: \`${feature.kind}\``,
    "",
    "Summary:",
    feature.summary,
    "",
    "Claimed validation assertions:",
    ...feature.claimed_assertion_ids.map((id) => `- \`${id}\``),
    "",
    "Acceptance criteria:",
    ...feature.acceptance_criteria.map((criterion) => `- ${criterion}`),
  ].join("\n");
}

function buildMilestoneDescription(input: {
  mission: Pick<Issue, "id" | "identifier">;
  milestone: MissionFeaturesDocument["milestones"][number];
}) {
  const { mission, milestone } = input;
  return [
    `Mission milestone generated from ${issueReference(mission)}.`,
    "",
    `Mission key: \`${milestone.id}\``,
    "",
    "Summary:",
    milestone.summary,
    "",
    "Features:",
    ...milestone.features.map((feature) => `- \`${feature.id}\` ${feature.title}`),
  ].join("\n");
}

function buildValidationDescription(input: {
  mission: Pick<Issue, "id" | "identifier">;
  milestone: MissionFeaturesDocument["milestones"][number];
}) {
  const { mission, milestone } = input;
  const assertions = [...new Set(milestone.features.flatMap((feature) => feature.claimed_assertion_ids))];
  return [
    `Mission validation gate generated from ${issueReference(mission)}.`,
    "",
    `Mission key: \`${milestone.id}:validation-round-1\``,
    `Milestone: \`${milestone.id}\` ${milestone.title}`,
    "",
    "Validate the completed milestone against the claimed assertions before any fix loop starts.",
    "",
    "Assertions in scope:",
    ...assertions.map((assertionId) => `- \`${assertionId}\``),
  ].join("\n");
}

function buildFixLoopDescription(input: {
  mission: Pick<Issue, "id" | "identifier">;
  milestone: MissionFeaturesDocument["milestones"][number];
}) {
  const { mission, milestone } = input;
  return [
    `Mission fix-loop placeholder generated from ${issueReference(mission)}.`,
    "",
    `Mission key: \`${milestone.id}:fix-loop\``,
    `Milestone: \`${milestone.id}\` ${milestone.title}`,
    "",
    "Use this placeholder to anchor fix issues created from blocking validation findings.",
  ].join("\n");
}

export function missionService(db: Db) {
  const issuesSvc = issueService(db);
  const documentsSvc = documentService(db);

  async function findGeneratedIssue(companyId: string, originKind: IssueOriginKind, originId: string) {
    const [existing] = await issuesSvc.list(companyId, {
      originKind,
      originId,
      limit: 1,
    });
    return existing ?? null;
  }

  async function ensureGeneratedIssue(input: {
    mission: MissionIssue;
    spec: GeneratedIssueSpec;
    actor: ActorInfo;
  }) {
    const { mission, spec, actor } = input;
    const existing = await findGeneratedIssue(mission.companyId, spec.originKind, spec.originId);
    const commonFields = {
      projectId: mission.projectId,
      projectWorkspaceId: mission.projectWorkspaceId,
      goalId: mission.goalId,
      parentId: spec.parentId,
      title: spec.title,
      description: spec.description,
      priority: spec.priority,
      billingCode: mission.billingCode ?? `mission:${mission.identifier ?? mission.id}`,
      executionWorkspaceId: mission.executionWorkspaceId,
      executionWorkspacePreference: mission.executionWorkspaceId ? "reuse_existing" : mission.executionWorkspacePreference,
      executionWorkspaceSettings: mission.executionWorkspaceSettings as Record<string, unknown> | null,
      blockedByIssueIds: spec.blockedByIssueIds,
    };

    if (existing) {
      const updated = await issuesSvc.update(existing.id, {
        ...commonFields,
        actorAgentId: actor.agentId ?? null,
        actorUserId: actor.userId ?? null,
      });
      if (!updated) throw notFound("Generated mission issue disappeared during update");
      return {
        issue: updated,
        created: false,
        changedIssueId: updated.id,
      };
    }

    const created = await issuesSvc.create(mission.companyId, {
      ...commonFields,
      status: spec.status,
      originKind: spec.originKind,
      originId: spec.originId,
      inheritExecutionWorkspaceFromIssueId: mission.id,
      createdByAgentId: actor.agentId ?? null,
      createdByUserId: actor.userId ?? null,
    });
    return {
      issue: created,
      created: true,
      changedIssueId: created.id,
    };
  }

  return {
    decompose: async (
      issueId: string,
      input: {
        actor: ActorInfo;
        dryRun?: boolean;
      },
    ): Promise<MissionDecompositionResult> => {
      const mission = await issuesSvc.getById(issueId);
      if (!mission) throw notFound("Mission issue not found");

      const [validationDocument, featuresDocument] = await Promise.all([
        documentsSvc.getIssueDocumentByKey(mission.id, "validation-contract"),
        documentsSvc.getIssueDocumentByKey(mission.id, "features"),
      ]);
      if (!validationDocument) throw unprocessable("Mission requires a validation-contract document before decomposition");
      if (!featuresDocument) throw unprocessable("Mission requires a features document before decomposition");

      let validationContract: ReturnType<typeof parseMissionValidationContractDocument>;
      let featurePlan: ReturnType<typeof parseMissionFeaturesDocument>;
      try {
        validationContract = parseMissionValidationContractDocument(validationDocument.body ?? "");
        featurePlan = parseMissionFeaturesDocument(featuresDocument.body ?? "");
      } catch (error) {
        const details =
          error && typeof error === "object" && "issues" in error
            ? { issues: (error as { issues: unknown }).issues }
            : undefined;
        throw unprocessable("Invalid mission validation-contract or features document", details);
      }
      const assertionIds = new Set(validationContract.assertions.map((assertion) => assertion.id));
      for (const milestone of featurePlan.milestones) {
        for (const feature of milestone.features) {
          for (const assertionId of feature.claimed_assertion_ids) {
            if (!assertionIds.has(assertionId)) {
              throw unprocessable(`Feature ${feature.id} claims unknown validation assertion ${assertionId}`);
            }
          }
        }
      }

      const specs: GeneratedIssueSpec[] = [];
      const milestoneIssueIds = new Map<string, string>();
      const featureIssueIdsByMilestone = new Map<string, string[]>();
      const validationIssueIds = new Map<string, string>();

      for (const milestone of featurePlan.milestones) {
        const milestoneSpec: GeneratedIssueSpec = {
          kind: "milestone",
          key: milestone.id,
          originKind: GENERATED_ORIGIN_KIND_BY_RESULT_KIND.milestone,
          originId: missionOriginId(mission.id, "milestone", milestone.id),
          title: `Mission milestone: ${milestone.title}`,
          description: buildMilestoneDescription({ mission, milestone }),
          parentId: mission.id,
          status: "todo",
          priority: "medium",
          blockedByIssueIds: [],
        };
        specs.push(milestoneSpec);
      }

      const resultIssues: MissionDecomposedIssue[] = [];
      const createdIssueIds: string[] = [];
      const updatedIssueIds: string[] = [];

      async function record(spec: GeneratedIssueSpec, issue: GeneratedIssueRow, created: boolean) {
        resultIssues.push({
          kind: spec.kind,
          key: spec.key,
          issueId: issue.id,
          identifier: issue.identifier ?? null,
          title: issue.title,
          created,
          blockedByIssueIds: spec.blockedByIssueIds,
        });
        if (created) createdIssueIds.push(issue.id);
        else updatedIssueIds.push(issue.id);
      }

      if (input.dryRun) {
        return {
          missionIssueId: mission.id,
          milestoneCount: featurePlan.milestones.length,
          featureCount: featurePlan.milestones.reduce((count, milestone) => count + milestone.features.length, 0),
          validationCount: featurePlan.milestones.length,
          fixLoopCount: featurePlan.milestones.length,
          createdIssueIds: [],
          updatedIssueIds: [],
          issues: specs.map((spec) => ({
            kind: spec.kind,
            key: spec.key,
            issueId: "",
            identifier: null,
            title: spec.title,
            created: false,
            blockedByIssueIds: spec.blockedByIssueIds,
          })),
        };
      }

      for (const spec of specs) {
        const { issue, created } = await ensureGeneratedIssue({ mission, spec, actor: input.actor });
        milestoneIssueIds.set(spec.key, issue.id);
        await record(spec, issue, created);
      }

      for (const milestone of featurePlan.milestones) {
        const parentId = milestoneIssueIds.get(milestone.id);
        if (!parentId) throw new Error(`Missing generated milestone issue for ${milestone.id}`);
        const featureIssueIds: string[] = [];
        for (const feature of milestone.features) {
          const spec: GeneratedIssueSpec = {
            kind: "feature",
            key: feature.id,
            originKind: GENERATED_ORIGIN_KIND_BY_RESULT_KIND.feature,
            originId: missionOriginId(mission.id, "feature", feature.id),
            title: `Mission feature: ${feature.title}`,
            description: buildFeatureDescription({ mission, milestone, feature }),
            parentId,
            status: "todo",
            priority: "medium",
            blockedByIssueIds: [],
          };
          const { issue, created } = await ensureGeneratedIssue({ mission, spec, actor: input.actor });
          featureIssueIds.push(issue.id);
          await record(spec, issue, created);
        }
        featureIssueIdsByMilestone.set(milestone.id, featureIssueIds);
      }

      for (const milestone of featurePlan.milestones) {
        const parentId = milestoneIssueIds.get(milestone.id);
        if (!parentId) throw new Error(`Missing generated milestone issue for ${milestone.id}`);
        const featureIssueIds = featureIssueIdsByMilestone.get(milestone.id) ?? [];
        const spec: GeneratedIssueSpec = {
          kind: "validation",
          key: `${milestone.id}:validation-round-1`,
          originKind: GENERATED_ORIGIN_KIND_BY_RESULT_KIND.validation,
          originId: missionOriginId(mission.id, "validation", `${milestone.id}:round-1`),
          title: `Mission validation: ${milestone.title} round 1`,
          description: buildValidationDescription({ mission, milestone }),
          parentId,
          status: "blocked",
          priority: "medium",
          blockedByIssueIds: featureIssueIds,
        };
        const { issue, created } = await ensureGeneratedIssue({ mission, spec, actor: input.actor });
        validationIssueIds.set(milestone.id, issue.id);
        await record(spec, issue, created);
      }

      for (const milestone of featurePlan.milestones) {
        const parentId = milestoneIssueIds.get(milestone.id);
        const validationIssueId = validationIssueIds.get(milestone.id);
        if (!parentId || !validationIssueId) {
          throw new Error(`Missing generated milestone or validation issue for ${milestone.id}`);
        }
        const spec: GeneratedIssueSpec = {
          kind: "fix_loop",
          key: `${milestone.id}:fix-loop`,
          originKind: GENERATED_ORIGIN_KIND_BY_RESULT_KIND.fix_loop,
          originId: missionOriginId(mission.id, "fix_loop", milestone.id),
          title: `Mission fix loop: ${milestone.title}`,
          description: buildFixLoopDescription({ mission, milestone }),
          parentId,
          status: "blocked",
          priority: "medium",
          blockedByIssueIds: [validationIssueId],
        };
        const { issue, created } = await ensureGeneratedIssue({ mission, spec, actor: input.actor });
        await record(spec, issue, created);

        await ensureGeneratedIssue({
          mission,
          spec: {
            kind: "milestone",
            key: milestone.id,
            originKind: GENERATED_ORIGIN_KIND_BY_RESULT_KIND.milestone,
            originId: missionOriginId(mission.id, "milestone", milestone.id),
            title: `Mission milestone: ${milestone.title}`,
            description: buildMilestoneDescription({ mission, milestone }),
            parentId: mission.id,
            status: "blocked",
            priority: "medium",
            blockedByIssueIds: [validationIssueId, issue.id],
          },
          actor: input.actor,
        });
      }

      return {
        missionIssueId: mission.id,
        milestoneCount: featurePlan.milestones.length,
        featureCount: featurePlan.milestones.reduce((count, milestone) => count + milestone.features.length, 0),
        validationCount: featurePlan.milestones.length,
        fixLoopCount: featurePlan.milestones.length,
        createdIssueIds,
        updatedIssueIds: [...new Set(updatedIssueIds.filter((id) => !createdIssueIds.includes(id)))],
        issues: resultIssues,
      };
    },
  };
}
