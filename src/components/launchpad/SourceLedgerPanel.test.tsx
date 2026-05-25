import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SourceLedgerPanel } from "./SourceLedgerPanel";
import type { CollaborationSyncAuditEvent } from "@/domain/collaboration-ingestion";
import type { LaunchArtifactSyncAuditEvent } from "@/domain/launch-artifact-ingestion";
import type { SalesforceSyncAuditEvent } from "@/domain/salesforce-ingestion";
import type { SmartsheetStatusSyncAuditEvent } from "@/domain/smartsheet-status";
import type { SourceSyncAuditEvent } from "@/domain/source-ingestion";
import {
  buildSourceRegistrationRecord,
  createPrototypeSourceRecords,
  type SourceRegistrationAuditEvent,
} from "@/domain/source-ledger";
import {
  defaultWorkspaceSession,
  type WorkspaceSession,
} from "@/domain/workspace";

const adminSession: WorkspaceSession = {
  ...defaultWorkspaceSession,
  user: {
    name: "Admin Reviewer",
    role: "admin",
    roleLabel: "Admin",
  },
};

type SourceLedgerAuditEvent =
  | SourceRegistrationAuditEvent
  | SourceSyncAuditEvent
  | CollaborationSyncAuditEvent
  | SalesforceSyncAuditEvent
  | LaunchArtifactSyncAuditEvent
  | SmartsheetStatusSyncAuditEvent;

function expectStatusRegionToHaveText(pattern: RegExp) {
  expect(
    screen.getAllByRole("status").some((region) =>
      pattern.test(region.textContent ?? ""),
    ),
  ).toBe(true);
}

describe("SourceLedgerPanel", () => {
  it("renders registered sources with provenance and source states", () => {
    render(
      <SourceLedgerPanel
        initialSources={createPrototypeSourceRecords()}
        session={adminSession}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /source ledger/i }),
    ).toBeVisible();
    const launchPlan = screen.getByRole("article", {
      name: /cardiomax launch plan/i,
    });

    expect(launchPlan).toBeVisible();
    expect(within(launchPlan).getByText(/source system: sharepoint/i))
      .toBeVisible();
    expect(screen.getByText(/approval: stale/i)).toBeVisible();
    expect(screen.getByText(/ingestion: stale/i)).toBeVisible();
    expect(screen.getByText(/access: restricted/i)).toBeVisible();
  });

  it("registers an admin source with validation feedback and an audit event", async () => {
    const user = userEvent.setup();
    const onSourceAuditEvent = vi.fn<(event: SourceLedgerAuditEvent) => void>();

    render(
      <SourceLedgerPanel
        initialSources={[]}
        onSourceAuditEvent={onSourceAuditEvent}
        session={adminSession}
      />,
    );

    await user.click(screen.getByRole("button", { name: /register source/i }));
    expectStatusRegionToHaveText(/source name is required/i);

    await user.type(
      screen.getByRole("textbox", { name: /source name/i }),
      "Regional readiness Teams channel",
    );
    await user.type(
      screen.getByRole("textbox", { name: /owning team/i }),
      "Deployment Solutions",
    );
    await user.type(
      screen.getByRole("textbox", { name: /object id/i }),
      "teams-regional-readiness",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /source system/i }),
      "teams",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /source type/i }),
      "teams_channel",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /approval state/i }),
      "draft",
    );
    await user.click(screen.getByRole("button", { name: /register source/i }));

    expectStatusRegionToHaveText(/source registered in source ledger/i);
    expect(screen.getByText(/regional readiness teams channel/i)).toBeVisible();
    expect(onSourceAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "Admin Reviewer",
        eventType: "source.created",
        metadata: expect.objectContaining({
          action: "created",
          sourceSystem: "teams",
        }),
      }),
    );
  });

  it("updates an existing source location instead of creating duplicates", async () => {
    const user = userEvent.setup();
    const onSourceAuditEvent = vi.fn<(event: SourceLedgerAuditEvent) => void>();

    render(
      <SourceLedgerPanel
        initialSources={[]}
        onSourceAuditEvent={onSourceAuditEvent}
        session={adminSession}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /source name/i }),
      "Regional readiness Teams channel",
    );
    await user.type(
      screen.getByRole("textbox", { name: /owning team/i }),
      "Deployment Solutions",
    );
    await user.type(
      screen.getByRole("textbox", { name: /object id/i }),
      "teams-regional-readiness",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /source system/i }),
      "teams",
    );
    await user.click(screen.getByRole("button", { name: /register source/i }));

    await user.type(
      screen.getByRole("textbox", { name: /source name/i }),
      "Regional readiness Teams channel updated",
    );
    await user.type(
      screen.getByRole("textbox", { name: /owning team/i }),
      "Deployment Solutions",
    );
    await user.type(
      screen.getByRole("textbox", { name: /object id/i }),
      "teams-regional-readiness",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /source system/i }),
      "teams",
    );
    await user.click(screen.getByRole("button", { name: /register source/i }));

    expectStatusRegionToHaveText(/source updated in source ledger/i);
    expect(
      screen.getAllByRole("article", {
        name: /regional readiness teams channel/i,
      }),
    ).toHaveLength(1);
    expect(onSourceAuditEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: "source.updated",
      }),
    );
  });

  it("does not update a different source system that happens to share a location key", async () => {
    const user = userEvent.setup();
    const sharedObjectId = "shared-enterprise-object";
    const existingTeamsSource = buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "fresh",
        ingestionStatus: "ready",
        objectId: sharedObjectId,
        owningTeam: "Launch Operations",
        sourceName: "Shared Teams source",
        sourceSystem: "teams",
        sourceType: "teams_channel",
      },
      {
        registeredAt: "2026-05-21T14:05:00.000Z",
        sourceId: "src-shared-teams-source",
      },
    );

    render(
      <SourceLedgerPanel
        initialSources={[existingTeamsSource]}
        session={adminSession}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /source name/i }),
      "Shared Salesforce source",
    );
    await user.type(
      screen.getByRole("textbox", { name: /owning team/i }),
      "Sales Operations",
    );
    await user.type(
      screen.getByRole("textbox", { name: /object id/i }),
      sharedObjectId,
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /source system/i }),
      "ecrm_salesforce",
    );
    await user.click(screen.getByRole("button", { name: /register source/i }));

    expectStatusRegionToHaveText(/source registered in source ledger/i);
    expect(
      screen.getByRole("article", { name: /shared teams source/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("article", { name: /shared salesforce source/i }),
    ).toBeVisible();
  });

  it("does not show save success when audit recording fails", async () => {
    const user = userEvent.setup();
    const onSourceAuditEvent = vi.fn(() => {
      throw new Error("audit unavailable");
    });

    render(
      <SourceLedgerPanel
        initialSources={[]}
        onSourceAuditEvent={onSourceAuditEvent}
        session={adminSession}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /source name/i }),
      "Regional readiness Teams channel",
    );
    await user.type(
      screen.getByRole("textbox", { name: /owning team/i }),
      "Deployment Solutions",
    );
    await user.type(
      screen.getByRole("textbox", { name: /object id/i }),
      "teams-regional-readiness",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /source system/i }),
      "teams",
    );
    await user.click(screen.getByRole("button", { name: /register source/i }));

    expectStatusRegionToHaveText(/audit recording failed/i);
    expect(screen.queryByText(/regional readiness teams channel/i))
      .not.toBeInTheDocument();
  });

  it("hides registration controls and redacts restricted details for non-admin users", () => {
    render(
      <SourceLedgerPanel
        initialSources={createPrototypeSourceRecords()}
        session={defaultWorkspaceSession}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /register source/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /run ingestion/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/restricted commercial launch plan/i))
      .not.toBeInTheDocument();
    expect(screen.getByText(/restricted source details are hidden/i))
      .toBeVisible();

    const restrictedResult = screen.getByRole("article", {
      name: /restricted source/i,
    });
    expect(within(restrictedResult).getByText(/source system: restricted/i))
      .toBeVisible();
    expect(restrictedResult).not.toHaveTextContent(/commercial strategy/i);
  });

  it("shows when records exist but no source details are accessible", () => {
    const restrictedSource = createPrototypeSourceRecords().filter(
      (source) => source.accessState === "restricted",
    );

    render(
      <SourceLedgerPanel
        initialSources={restrictedSource}
        session={defaultWorkspaceSession}
      />,
    );

    expectStatusRegionToHaveText(/no accessible source details are available/i);
  });

  it("searches, filters, summarizes, and clears Source Ledger results", async () => {
    const user = userEvent.setup();

    render(
      <SourceLedgerPanel
        initialSources={createPrototypeSourceRecords()}
        session={adminSession}
      />,
    );

    await user.type(
      screen.getByRole("searchbox", { name: /search sources/i }),
      "salesforce",
    );

    expect(screen.getByRole("status", { name: /source result count/i }))
      .toHaveTextContent(/1 of 9 source records match current filters/i);
    expect(screen.getByText(/search: salesforce/i)).toBeVisible();
    expect(screen.getByRole("article", {
      name: /cardiomax salesforce launch context/i,
    })).toBeVisible();
    expect(screen.queryByRole("article", {
      name: /cardiomax launch plan/i,
    })).not.toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: /search sources/i }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: /system filter/i }),
      "asset",
    );

    expect(
      within(
        screen.getByRole("region", {
          name: /search and filter source ledger/i,
        }),
      ).getByText(/source system: asset/i),
    ).toBeVisible();
    expect(screen.getByRole("article", {
      name: /cardiomax approved asset library/i,
    })).toBeVisible();
    expect(screen.queryByRole("article", {
      name: /cardiomax deployment handoff/i,
    })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear filters/i }));

    expect(screen.getByRole("status", { name: /source result count/i }))
      .toHaveTextContent(/9 source records available/i);
    expect(screen.getByRole("article", {
      name: /cardiomax deployment handoff/i,
    })).toBeVisible();
  });

  it("inspects normalized source details with match rationale and next action", async () => {
    const user = userEvent.setup();

    render(
      <SourceLedgerPanel
        initialSources={createPrototypeSourceRecords()}
        session={adminSession}
      />,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: /freshness filter/i }),
      "stale",
    );
    const smartsheetResult = screen.getByRole("article", {
      name: /cardiomax smartsheet status/i,
    });

    expect(smartsheetResult).toHaveTextContent(/matched freshness/i);
    await user.click(
      within(smartsheetResult).getByRole("button", {
        name: /show details for cardiomax smartsheet status/i,
      }),
    );

    expect(within(smartsheetResult).getByText(/source id:/i)).toBeVisible();
    expect(within(smartsheetResult).getByText(/object id:/i)).toBeVisible();
    expect(within(smartsheetResult).getByText(/ingestion history:/i))
      .toBeVisible();
    expect(within(smartsheetResult).getByText(/registered:/i)).toBeVisible();
    expect(within(smartsheetResult).getByText(/related launch:/i)).toBeVisible();
    expect(within(smartsheetResult).getByText(/next useful action:/i))
      .toBeVisible();
    expect(
      within(smartsheetResult).getByRole("link", {
        name: /\/sources#cardiomax-smartsheet-status/i,
      }),
    ).toHaveAttribute("href", "/sources#cardiomax-smartsheet-status");
    expect(smartsheetResult).toHaveTextContent(
      /refresh this source or verify the latest source freshness/i,
    );
    expect(smartsheetResult).not.toHaveTextContent(/rawGraphPayload/i);
  });

  it("keeps search and details redaction-safe for non-admin users", async () => {
    const user = userEvent.setup();

    render(
      <SourceLedgerPanel
        initialSources={createPrototypeSourceRecords()}
        session={defaultWorkspaceSession}
      />,
    );

    await user.type(
      screen.getByRole("searchbox", { name: /search sources/i }),
      "commercial",
    );

    expect(screen.getByRole("status", { name: /source result count/i }))
      .toHaveTextContent(/0 of 9 source records match current filters/i);
    expect(screen.getByText(/no sources match current filters/i)).toBeVisible();
    expect(screen.queryByText(/restricted commercial launch plan/i))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/commercial strategy/i)).not.toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: /search sources/i }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: /access filter/i }),
      "restricted",
    );
    const restrictedResult = screen.getByRole("article", {
      name: /restricted source/i,
    });
    await user.click(
      within(restrictedResult).getByRole("button", {
        name: /show details for restricted source/i,
      }),
    );

    expect(restrictedResult).toHaveTextContent(/source title: restricted source/i);
    expect(restrictedResult).toHaveTextContent(/next useful action:/i);
    expect(
      within(restrictedResult).queryByRole("link", {
        name: /open source: restricted source/i,
      }),
    ).not.toBeInTheDocument();
    expect(restrictedResult).not.toHaveTextContent(/restricted commercial/i);
    expect(restrictedResult).not.toHaveTextContent(/commercial strategy/i);
  });

  it("shows empty, loading, and error states", () => {
    const { rerender } = render(
      <SourceLedgerPanel initialSources={[]} session={adminSession} />,
    );

    expect(screen.getByText(/no registered sources yet/i)).toBeVisible();

    rerender(
      <SourceLedgerPanel
        initialSources={[]}
        session={adminSession}
        viewState="loading"
      />,
    );
    expectStatusRegionToHaveText(/retrieving sources/i);

    rerender(
      <SourceLedgerPanel
        initialSources={[]}
        session={adminSession}
        viewState="error"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /source ledger could not load/i,
    );
  });

  it("hides filters and stale results while sources are loading or errored", () => {
    const { rerender } = render(
      <SourceLedgerPanel
        initialSources={createPrototypeSourceRecords()}
        session={adminSession}
        viewState="loading"
      />,
    );

    expect(screen.queryByRole("searchbox", { name: /search sources/i }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("article", { name: /cardiomax launch plan/i }))
      .not.toBeInTheDocument();

    rerender(
      <SourceLedgerPanel
        initialSources={createPrototypeSourceRecords()}
        session={adminSession}
        viewState="error"
      />,
    );

    expect(screen.queryByRole("searchbox", { name: /search sources/i }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("article", { name: /cardiomax launch plan/i }))
      .not.toBeInTheDocument();
  });

  it("syncs loaded source props while preserving local registrations", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SourceLedgerPanel initialSources={[]} session={adminSession} />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /source name/i }),
      "Local admin source",
    );
    await user.type(
      screen.getByRole("textbox", { name: /owning team/i }),
      "Launch Operations",
    );
    await user.type(
      screen.getByRole("textbox", { name: /object id/i }),
      "local-admin-source",
    );
    await user.click(screen.getByRole("button", { name: /register source/i }));

    rerender(
      <SourceLedgerPanel
        initialSources={createPrototypeSourceRecords()}
        session={adminSession}
      />,
    );

    expect(screen.getByText(/local admin source/i)).toBeVisible();
    expect(screen.getByText(/cardiomax launch plan/i)).toBeVisible();
  });

  it("runs admin ingestion for eligible Microsoft document sources", async () => {
    const user = userEvent.setup();
    const onSourceAuditEvent = vi.fn<(event: SourceLedgerAuditEvent) => void>();
    const [launchPlan] = createPrototypeSourceRecords();

    render(
      <SourceLedgerPanel
        initialSources={[
          {
            ...launchPlan,
            freshnessState: "watch",
            ingestionStatus: "ready",
            lastRefreshedAt: undefined,
          },
        ]}
        onSourceAuditEvent={onSourceAuditEvent}
        session={adminSession}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /run ingestion for cardiomax launch plan/i,
      }),
    );

    expectStatusRegionToHaveText(/2 normalized text records prepared for retrieval/i);
    const launchPlanResult = screen.getByRole("article", {
      name: /cardiomax launch plan/i,
    });
    expect(within(launchPlanResult).getByText(/freshness: fresh/i))
      .toBeVisible();
    expect(within(launchPlanResult).getByText(/ingestion: complete/i))
      .toBeVisible();
    expect(launchPlanResult).toHaveTextContent(
      /2 normalized text records prepared for retrieval/i,
    );
    expect(onSourceAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "source.sync_completed",
        metadata: expect.objectContaining({
          extractedRecordCount: 2,
          freshnessState: "fresh",
          sourceId: "src-cardiomax-launch-plan",
          sourceSystem: "sharepoint",
          syncStatus: "completed",
        }),
      }),
    );
    expect(document.body).not.toHaveTextContent(/credentialToken/i);
    expect(document.body).not.toHaveTextContent(/rawGraphPayload/i);
  });

  it("shows a user-safe ingestion failure and sync audit event", async () => {
    const user = userEvent.setup();
    const onSourceAuditEvent = vi.fn<(event: SourceLedgerAuditEvent) => void>();
    const connectorFailureSource = buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "fresh",
        ingestionStatus: "ready",
        objectId: "connector-failure-cardiomax-plan",
        owningTeam: "Launch Operations",
        sourceName: "CARDIOMAX connector failure source",
        sourceSystem: "sharepoint",
        sourceType: "sharepoint_site",
        sourceUrl: "/sources#connector-failure",
      },
      {
        registeredAt: "2026-05-21T12:45:00.000Z",
        sourceId: "src-cardiomax-connector-failure",
      },
    );

    render(
      <SourceLedgerPanel
        initialSources={[connectorFailureSource]}
        onSourceAuditEvent={onSourceAuditEvent}
        session={adminSession}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /run ingestion for cardiomax connector failure source/i,
      }),
    );

    expectStatusRegionToHaveText(/could not be retrieved/i);
    const failureResult = screen.getByRole("article", {
      name: /cardiomax connector failure source/i,
    });
    expect(within(failureResult).getByText(/freshness: stale/i)).toBeVisible();
    expect(within(failureResult).getByText(/ingestion: failed/i)).toBeVisible();
    expect(failureResult).toHaveTextContent(/could not be retrieved/i);
    expect(failureResult).not.toHaveTextContent(/connector stack/i);
    expect(onSourceAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "source.sync_failed",
        metadata: expect.objectContaining({
          failureState: "connector_unavailable",
          freshnessState: "stale",
          sourceId: "src-cardiomax-connector-failure",
          syncStatus: "failed",
        }),
      }),
    );
  });

  it("runs governed Teams ingestion for eligible collaboration sources", async () => {
    const user = userEvent.setup();
    const onSourceAuditEvent = vi.fn<(event: SourceLedgerAuditEvent) => void>();
    const teamsSource = buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "watch",
        ingestionStatus: "ready",
        objectId: "teams-cardiomax-decisions",
        owningTeam: "Launch Operations",
        sourceName: "CARDIOMAX Teams Decisions",
        sourceSystem: "teams",
        sourceType: "teams_channel",
        sourceUrl: "https://teams.microsoft.com/l/channel/cardiomax-decisions",
      },
      {
        registeredAt: "2026-05-21T13:20:00.000Z",
        sourceId: "src-cardiomax-teams-decisions",
      },
    );

    render(
      <SourceLedgerPanel
        initialSources={[teamsSource]}
        onSourceAuditEvent={onSourceAuditEvent}
        session={adminSession}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /run ingestion for cardiomax teams decisions/i,
      }),
    );

    expectStatusRegionToHaveText(
      /2 governed collaboration summaries prepared for retrieval/i,
    );
    const teamsResult = screen.getByRole("article", {
      name: /cardiomax teams decisions/i,
    });
    expect(within(teamsResult).getByText(/freshness: fresh/i)).toBeVisible();
    expect(within(teamsResult).getByText(/ingestion: complete/i)).toBeVisible();
    expect(teamsResult).toHaveTextContent(
      /2 governed collaboration summaries prepared for retrieval/i,
    );
    expect(onSourceAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "source.sync_completed",
        metadata: expect.objectContaining({
          contextRecordCount: 2,
          freshnessState: "fresh",
          sourceId: "src-cardiomax-teams-decisions",
          sourceSystem: "teams",
          syncStatus: "completed",
        }),
      }),
    );
    expect(document.body).not.toHaveTextContent(/credentialToken/i);
    expect(document.body).not.toHaveTextContent(/rawGraphPayload/i);
  });

  it("shows a user-safe governance skip for Teams and email sync", async () => {
    const user = userEvent.setup();
    const onSourceAuditEvent = vi.fn<(event: SourceLedgerAuditEvent) => void>();
    const governanceSkippedSource = buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "fresh",
        ingestionStatus: "ready",
        objectId: "governance-skip-email-launch-thread",
        owningTeam: "Launch Operations",
        sourceName: "CARDIOMAX governance skipped email thread",
        sourceSystem: "email",
        sourceType: "email_mailbox",
      },
      {
        registeredAt: "2026-05-21T13:35:00.000Z",
        sourceId: "src-cardiomax-governance-skipped-email",
      },
    );

    render(
      <SourceLedgerPanel
        initialSources={[governanceSkippedSource]}
        onSourceAuditEvent={onSourceAuditEvent}
        session={adminSession}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /run ingestion for cardiomax governance skipped email thread/i,
      }),
    );

    expectStatusRegionToHaveText(/skipped by governance or retention policy/i);
    const emailResult = screen.getByRole("article", {
      name: /cardiomax governance skipped email thread/i,
    });
    expect(within(emailResult).getByText(/freshness: watch/i)).toBeVisible();
    expect(within(emailResult).getByText(/ingestion: incomplete/i)).toBeVisible();
    expect(emailResult).toHaveTextContent(
      /skipped by governance or retention policy/i,
    );
    expect(emailResult).not.toHaveTextContent(/rawGraphPayload/i);
    expect(onSourceAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "source.sync_skipped",
        metadata: expect.objectContaining({
          reasonState: "governance_skipped",
          sourceId: "src-cardiomax-governance-skipped-email",
          sourceSystem: "email",
          syncStatus: "skipped",
        }),
      }),
    );
  });

  it("runs Salesforce ingestion for eligible ECRM sources", async () => {
    const user = userEvent.setup();
    const onSourceAuditEvent = vi.fn<(event: SourceLedgerAuditEvent) => void>();
    const salesforceSource = buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "watch",
        ingestionStatus: "ready",
        objectId: "006CARDIOMAX",
        owningTeam: "Sales Operations",
        sourceName: "CARDIOMAX Salesforce Launch Context",
        sourceSystem: "ecrm_salesforce",
        sourceType: "salesforce_record",
        sourceUrl:
          "https://example.my.salesforce.com/lightning/r/Opportunity/006CARDIOMAX/view",
      },
      {
        registeredAt: "2026-05-21T14:20:00.000Z",
        sourceId: "src-cardiomax-salesforce-context",
      },
    );

    render(
      <SourceLedgerPanel
        initialSources={[salesforceSource]}
        onSourceAuditEvent={onSourceAuditEvent}
        session={adminSession}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /run ingestion for cardiomax salesforce launch context/i,
      }),
    );

    expectStatusRegionToHaveText(
      /1 salesforce launch context record prepared for retrieval/i,
    );
    const salesforceResult = screen.getByRole("article", {
      name: /cardiomax salesforce context/i,
    });
    expect(within(salesforceResult).getByText(/freshness: fresh/i))
      .toBeVisible();
    expect(within(salesforceResult).getByText(/ingestion: complete/i))
      .toBeVisible();
    expect(
      within(salesforceResult).getByText(/source-link health: healthy/i),
    ).toBeVisible();
    expect(salesforceResult).toHaveTextContent(
      /1 salesforce launch context record prepared for retrieval/i,
    );
    expect(onSourceAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "source.sync_completed",
        metadata: expect.objectContaining({
          contextRecordCount: 1,
          freshnessState: "fresh",
          sourceId: "src-cardiomax-salesforce-context",
          sourceSystem: "ecrm_salesforce",
          syncStatus: "completed",
        }),
      }),
    );
    expect(document.body).not.toHaveTextContent(/bearerToken/i);
    expect(document.body).not.toHaveTextContent(/rawSalesforcePayload/i);
  });

  it("runs read-only Smartsheet status ingestion for eligible sheet sources", async () => {
    const user = userEvent.setup();
    const onSourceAuditEvent = vi.fn<(event: SourceLedgerAuditEvent) => void>();
    const smartsheetSource = buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "watch",
        ingestionStatus: "ready",
        objectId: "smartsheet-cardiomax-approved-status",
        owningTeam: "Project Management",
        sourceName: "CARDIOMAX Approved Smartsheet Status",
        sourceSystem: "smartsheet",
        sourceType: "smartsheet_sheet",
        sourceUrl: "/sources#cardiomax-approved-smartsheet-status",
      },
      {
        registeredAt: "2026-05-21T12:12:00.000Z",
        sourceId: "src-cardiomax-smartsheet-approved-status",
      },
    );

    render(
      <SourceLedgerPanel
        initialSources={[smartsheetSource]}
        onSourceAuditEvent={onSourceAuditEvent}
        session={adminSession}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /run ingestion for cardiomax approved smartsheet status/i,
      }),
    );

    expectStatusRegionToHaveText(
      /3 smartsheet project status records prepared for retrieval/i,
    );
    const smartsheetResult = screen.getByRole("article", {
      name: /cardiomax approved smartsheet status/i,
    });
    expect(within(smartsheetResult).getByText(/freshness: stale/i))
      .toBeVisible();
    expect(within(smartsheetResult).getByText(/ingestion: complete/i))
      .toBeVisible();
    expect(smartsheetResult).toHaveTextContent(/1 record marked source-stale/i);
    expect(onSourceAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "source.sync_completed",
        metadata: expect.objectContaining({
          recordCounts: expect.objectContaining({
            launchTasks: 3,
            rows: 3,
            staleRows: 1,
          }),
          sourceId: "src-cardiomax-smartsheet-approved-status",
          sourceSystem: "smartsheet",
          syncStatus: "completed",
        }),
      }),
    );
    expect(document.body).not.toHaveTextContent(/rawSmartsheetPayload/i);
    expect(document.body).not.toHaveTextContent(/credentialToken/i);
  });

  it("shows user-safe Smartsheet incomplete and connector failure states", async () => {
    const user = userEvent.setup();
    const onSourceAuditEvent = vi.fn<(event: SourceLedgerAuditEvent) => void>();
    const incompleteSmartsheetSource = buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "watch",
        ingestionStatus: "ready",
        objectId: "missing-fields-smartsheet-status",
        owningTeam: "Project Management",
        sourceName: "CARDIOMAX incomplete Smartsheet status",
        sourceSystem: "smartsheet",
        sourceType: "smartsheet_sheet",
      },
      {
        registeredAt: "2026-05-21T12:14:00.000Z",
        sourceId: "src-cardiomax-incomplete-smartsheet-status",
      },
    );
    const connectorFailureSource = buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "watch",
        ingestionStatus: "ready",
        objectId: "connector-failure-smartsheet-status",
        owningTeam: "Project Management",
        sourceName: "CARDIOMAX Smartsheet connector failure source",
        sourceSystem: "smartsheet",
        sourceType: "smartsheet_sheet",
      },
      {
        registeredAt: "2026-05-21T12:16:00.000Z",
        sourceId: "src-cardiomax-smartsheet-connector-failure",
      },
    );

    render(
      <SourceLedgerPanel
        initialSources={[incompleteSmartsheetSource, connectorFailureSource]}
        onSourceAuditEvent={onSourceAuditEvent}
        session={adminSession}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /run ingestion for cardiomax incomplete smartsheet status/i,
      }),
    );

    expectStatusRegionToHaveText(/smartsheet project status ingestion partially completed/i);
    const incompleteResult = screen.getByRole("article", {
      name: /cardiomax incomplete smartsheet status/i,
    });
    expect(within(incompleteResult).getByText(/freshness: watch/i))
      .toBeVisible();
    expect(within(incompleteResult).getByText(/ingestion: incomplete/i))
      .toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: /run ingestion for cardiomax smartsheet connector failure source/i,
      }),
    );

    expectStatusRegionToHaveText(/smartsheet project status could not be retrieved/i);
    const failureResult = screen.getByRole("article", {
      name: /cardiomax smartsheet connector failure source/i,
    });
    expect(within(failureResult).getByText(/freshness: stale/i)).toBeVisible();
    expect(within(failureResult).getByText(/ingestion: failed/i)).toBeVisible();
    expect(failureResult).not.toHaveTextContent(/connector stack/i);
    expect(onSourceAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "source.sync_failed",
        metadata: expect.objectContaining({
          reasonState: "connector_unavailable",
          sourceId: "src-cardiomax-smartsheet-connector-failure",
          sourceSystem: "smartsheet",
          syncStatus: "failed",
        }),
      }),
    );
  });

  it("shows a user-safe restricted state for Salesforce sync", async () => {
    const user = userEvent.setup();
    const onSourceAuditEvent = vi.fn<(event: SourceLedgerAuditEvent) => void>();
    const restrictedSource = buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "watch",
        ingestionStatus: "ready",
        objectId: "access-restricted-salesforce-record",
        owningTeam: "Sales Operations",
        sourceName: "CARDIOMAX restricted Salesforce record",
        sourceSystem: "ecrm_salesforce",
        sourceType: "salesforce_record",
      },
      {
        registeredAt: "2026-05-21T14:40:00.000Z",
        sourceId: "src-cardiomax-restricted-salesforce",
      },
    );

    render(
      <SourceLedgerPanel
        initialSources={[restrictedSource]}
        onSourceAuditEvent={onSourceAuditEvent}
        session={adminSession}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /run ingestion for cardiomax restricted salesforce record/i,
      }),
    );

    expectStatusRegionToHaveText(/access restricted/i);
    const restrictedResult = screen.getByRole("article", {
      name: /cardiomax restricted salesforce record/i,
    });
    expect(within(restrictedResult).getByText(/freshness: restricted/i))
      .toBeVisible();
    expect(within(restrictedResult).getByText(/ingestion: restricted/i))
      .toBeVisible();
    expect(restrictedResult).toHaveTextContent(
      /salesforce launch context is not available/i,
    );
    expect(onSourceAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "source.sync_skipped",
        metadata: expect.objectContaining({
          reasonState: "access_restricted",
          sourceId: "src-cardiomax-restricted-salesforce",
          sourceSystem: "ecrm_salesforce",
          syncStatus: "skipped",
        }),
      }),
    );
  });

  it("shows a user-safe Salesforce connector failure", async () => {
    const user = userEvent.setup();
    const onSourceAuditEvent = vi.fn<(event: SourceLedgerAuditEvent) => void>();
    const connectorFailureSource = buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "fresh",
        ingestionStatus: "ready",
        objectId: "connector-failure-salesforce-record",
        owningTeam: "Sales Operations",
        sourceName: "CARDIOMAX Salesforce connector failure source",
        sourceSystem: "ecrm_salesforce",
        sourceType: "salesforce_record",
      },
      {
        registeredAt: "2026-05-21T14:45:00.000Z",
        sourceId: "src-cardiomax-salesforce-connector-failure",
      },
    );

    render(
      <SourceLedgerPanel
        initialSources={[connectorFailureSource]}
        onSourceAuditEvent={onSourceAuditEvent}
        session={adminSession}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /run ingestion for cardiomax salesforce connector failure source/i,
      }),
    );

    expectStatusRegionToHaveText(/could not be retrieved/i);
    const failureResult = screen.getByRole("article", {
      name: /cardiomax salesforce connector failure source/i,
    });
    expect(within(failureResult).getByText(/freshness: stale/i)).toBeVisible();
    expect(within(failureResult).getByText(/ingestion: failed/i)).toBeVisible();
    expect(failureResult).toHaveTextContent(/could not be retrieved/i);
    expect(failureResult).not.toHaveTextContent(/connector stack/i);
    expect(onSourceAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "source.sync_failed",
        metadata: expect.objectContaining({
          reasonState: "connector_unavailable",
          sourceId: "src-cardiomax-salesforce-connector-failure",
          syncStatus: "failed",
        }),
      }),
    );
  });

  it("runs structured Playbook ingestion for eligible launch artifact sources", async () => {
    const user = userEvent.setup();
    const onSourceAuditEvent = vi.fn<(event: SourceLedgerAuditEvent) => void>();
    const playbookSource = buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "watch",
        ingestionStatus: "ready",
        objectId: "playbook-cardiomax-tier-2",
        owningTeam: "Launch Excellence",
        sourceName: "CARDIOMAX Tier 2 Launch Playbook",
        sourceSystem: "playbook",
        sourceType: "playbook",
        sourceUrl: "/sources#cardiomax-tier-2-playbook",
      },
      {
        registeredAt: "2026-05-21T15:00:00.000Z",
        sourceId: "src-cardiomax-tier-2-playbook",
      },
    );

    render(
      <SourceLedgerPanel
        initialSources={[playbookSource]}
        onSourceAuditEvent={onSourceAuditEvent}
        session={adminSession}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /run ingestion for cardiomax tier 2 launch playbook/i,
      }),
    );

    expectStatusRegionToHaveText(/1 playbook template prepared for retrieval/i);
    const playbookResult = screen.getByRole("article", {
      name: /cardiomax tier 2 launch playbook/i,
    });
    expect(within(playbookResult).getByText(/freshness: fresh/i)).toBeVisible();
    expect(within(playbookResult).getByText(/ingestion: complete/i))
      .toBeVisible();
    expect(playbookResult).toHaveTextContent(
      /1 playbook template prepared for retrieval/i,
    );
    expect(onSourceAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "source.sync_completed",
        metadata: expect.objectContaining({
          launchId: "launch-cardiomax-2026",
          recordCounts: expect.objectContaining({
            playbookTemplates: 1,
          }),
          sourceId: "src-cardiomax-tier-2-playbook",
          sourceSystem: "playbook",
          syncStatus: "completed",
        }),
      }),
    );
    expect(document.body).not.toHaveTextContent(/rawConnectorPayload/i);
    expect(document.body).not.toHaveTextContent(/credentialToken/i);
  });

  it("shows incomplete structured handoff ingestion without fabricating missing fields", async () => {
    const user = userEvent.setup();
    const onSourceAuditEvent = vi.fn<(event: SourceLedgerAuditEvent) => void>();
    const incompleteHandoffSource = buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "watch",
        ingestionStatus: "ready",
        objectId: "missing-handoff-cardiomax-deployment",
        owningTeam: "Deployment Solutions",
        sourceName: "CARDIOMAX incomplete deployment handoff",
        sourceSystem: "handoff",
        sourceType: "handoff_artifact",
      },
      {
        registeredAt: "2026-05-21T15:20:00.000Z",
        sourceId: "src-cardiomax-incomplete-handoff",
      },
    );

    render(
      <SourceLedgerPanel
        initialSources={[incompleteHandoffSource]}
        onSourceAuditEvent={onSourceAuditEvent}
        session={adminSession}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /run ingestion for cardiomax incomplete deployment handoff/i,
      }),
    );

    expectStatusRegionToHaveText(/required artifact information is missing/i);
    const handoffResult = screen.getByRole("article", {
      name: /cardiomax incomplete deployment handoff/i,
    });
    expect(within(handoffResult).getByText(/freshness: watch/i)).toBeVisible();
    expect(within(handoffResult).getByText(/ingestion: incomplete/i))
      .toBeVisible();
    expect(onSourceAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "source.sync_failed",
        metadata: expect.objectContaining({
          reasonState: "missing_information",
          sourceId: "src-cardiomax-incomplete-handoff",
          sourceSystem: "handoff",
          syncStatus: "incomplete",
        }),
      }),
    );
  });

  it("shows a user-safe structured artifact connector failure", async () => {
    const user = userEvent.setup();
    const onSourceAuditEvent = vi.fn<(event: SourceLedgerAuditEvent) => void>();
    const connectorFailureSource = buildSourceRegistrationRecord(
      {
        accessState: "authorized",
        approvalState: "approved",
        freshnessState: "fresh",
        ingestionStatus: "ready",
        objectId: "connector-failure-playbook",
        owningTeam: "Launch Excellence",
        sourceName: "CARDIOMAX playbook connector failure source",
        sourceSystem: "playbook",
        sourceType: "playbook",
      },
      {
        registeredAt: "2026-05-21T15:30:00.000Z",
        sourceId: "src-cardiomax-playbook-connector-failure",
      },
    );

    render(
      <SourceLedgerPanel
        initialSources={[connectorFailureSource]}
        onSourceAuditEvent={onSourceAuditEvent}
        session={adminSession}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /run ingestion for cardiomax playbook connector failure source/i,
      }),
    );

    expectStatusRegionToHaveText(
      /structured launch artifacts could not be retrieved/i,
    );
    const failureResult = screen.getByRole("article", {
      name: /cardiomax playbook connector failure source/i,
    });
    expect(within(failureResult).getByText(/freshness: stale/i)).toBeVisible();
    expect(within(failureResult).getByText(/ingestion: failed/i)).toBeVisible();
    expect(failureResult).not.toHaveTextContent(/connector stack/i);
    expect(onSourceAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "source.sync_failed",
        metadata: expect.objectContaining({
          reasonState: "connector_unavailable",
          sourceId: "src-cardiomax-playbook-connector-failure",
          syncStatus: "failed",
        }),
      }),
    );
  });
});
