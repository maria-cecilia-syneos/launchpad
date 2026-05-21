import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SourceLedgerPanel } from "./SourceLedgerPanel";
import type { CollaborationSyncAuditEvent } from "@/domain/collaboration-ingestion";
import type { SalesforceSyncAuditEvent } from "@/domain/salesforce-ingestion";
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
  | SalesforceSyncAuditEvent;

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
    expect(screen.getByRole("status")).toHaveTextContent(
      /source name is required/i,
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
    await user.selectOptions(
      screen.getByRole("combobox", { name: /source type/i }),
      "teams_channel",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /approval state/i }),
      "draft",
    );
    await user.click(screen.getByRole("button", { name: /register source/i }));

    expect(screen.getByRole("status")).toHaveTextContent(
      /source registered in source ledger/i,
    );
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

    expect(screen.getByRole("status")).toHaveTextContent(
      /source updated in source ledger/i,
    );
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

    expect(screen.getByRole("status")).toHaveTextContent(
      /source registered in source ledger/i,
    );
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

    expect(screen.getByRole("status")).toHaveTextContent(
      /audit recording failed/i,
    );
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

    expect(screen.getByRole("status")).toHaveTextContent(
      /no accessible source details are available/i,
    );
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
    expect(screen.getByRole("status")).toHaveTextContent(
      /retrieving sources/i,
    );

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

    expect(screen.getByRole("status")).toHaveTextContent(
      /2 normalized text records prepared for retrieval/i,
    );
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

    expect(screen.getByRole("status")).toHaveTextContent(
      /could not be retrieved/i,
    );
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

    expect(screen.getByRole("status")).toHaveTextContent(
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

    expect(screen.getByRole("status")).toHaveTextContent(
      /skipped by governance or retention policy/i,
    );
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

    expect(screen.getByRole("status")).toHaveTextContent(
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

    expect(screen.getByRole("status")).toHaveTextContent(
      /access restricted/i,
    );
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

    expect(screen.getByRole("status")).toHaveTextContent(
      /could not be retrieved/i,
    );
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
});
