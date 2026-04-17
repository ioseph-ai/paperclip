import { describe, expect, it } from "vitest";
import {
  parseMissionFeaturesDocument,
  parseMissionValidationContractDocument,
} from "@paperclipai/shared";

describe("mission document parsers", () => {
  it("parses validation contracts and feature plans from markdown", () => {
    const validation = parseMissionValidationContractDocument(`
### VAL-MISSION-001: Mission decomposition creates child issues

- User value: The board can inspect generated work.
- Scope: Missions
- Setup: Seeded mission issue
- Steps: Run decomposition, inspect child issues
- Oracle: Generated children and blockers match the plan
- Tooling: api call
- Evidence: API response
- Claimed by: FEAT-MISSION-001
- Status: claimed
`);

    const features = parseMissionFeaturesDocument(`
## MILESTONE-MISSION-001: Foundation

- Summary: Create the initial mission mechanics.

### FEAT-MISSION-001: Decompose mission work

- Summary: Create ordered child issues from stable feature keys.
- Acceptance criteria: Milestone issue exists, feature issue exists, validation is blocked
- Claims: VAL-MISSION-001
`);

    expect(validation.assertions).toHaveLength(1);
    expect(validation.assertions[0]).toMatchObject({
      id: "VAL-MISSION-001",
      claimed_by: ["FEAT-MISSION-001"],
      status: "claimed",
    });
    expect(features.milestones).toHaveLength(1);
    expect(features.milestones[0]?.features[0]).toMatchObject({
      id: "FEAT-MISSION-001",
      claimed_assertion_ids: ["VAL-MISSION-001"],
    });
  });
});
